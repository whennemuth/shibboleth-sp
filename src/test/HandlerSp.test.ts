import { jest } from '@jest/globals';
import { AUTH_PATHS, handler } from '../HandlerSp';
import { SamlResponseObject, SendAssertResult } from '../Saml';
import { MockSamlAssertResponse } from './SamlAssertResponseFriendlyMock';
import { JwtTools } from '../Jwt';
import { IConfig } from '../Config';
import { IRequest, IResponse, RequestHeaders, Headers } from '../Http';

const domain = 'wp1.warhen.work';
const uri = '/path/to/app';
const loginUrl = 'https://shib-test.bu.edu/idp/profile/SAML2/Redirect/SSO?SAMLRequest=some_base64_value';
const logoutUrl = 'https://shib-test.bu.edu/Shibboleth.sso/Logout';

/**
 * ---------------------------------------------------------------------------
 *                             CREATE MOCKS 
 * (beware: must define at global scope - no outer function, if blocks, etc.)
 * ---------------------------------------------------------------------------
 */


/**
 * Partial mock for SamlTools. Mocks the sendAssert function to return either good or bad result.
 * 
 * @remarks Using mockImplementation() for ES6 class mocking, but beware of gotchas.
 * 
 * @see https://jestjs.io/docs/es6-class-mocks#calling-jestmock-with-the-module-factory-parameter
 */
jest.mock('../Saml', () => {
  if(process.env?.unmocked === 'true') {
    return jest.requireActual('../Saml');
  }
  return {
    SamlTools: jest.fn().mockImplementation(() => {
      return {
        setSpCertificate: (cert: string) => jest.fn(),
        setPrivateKey: (key: string) => jest.fn(),
        setAssertUrl: (url: string) => jest.fn(),
        createLoginRequestUrl: async (path: string) => {
          return new Promise((resolve, reject) => {
            resolve(loginUrl);
          })
        },
        createLogoutRequestUrl: async () => {
          return new Promise((resolve, reject) => {
            resolve(logoutUrl);
          })
        },
        getSamlResponseParameter: (request: any):SamlResponseObject|null => {
          return {
            samlResponseParm: '',
            xmlData: ''
          } as SamlResponseObject;
        },
        sendAssert: async (request:any): Promise<SendAssertResult|null> => {
          return new Promise((resolve, reject) => {
            const scenario = request.headers['TEST_SCENARIO'][0].value;
            switch(scenario) {
              case 'good':
                resolve({
                  samlAssertResponse: MockSamlAssertResponse,
                  relayState: encodeURIComponent(`https://${domain}${uri}`)
                });
                break;
              case 'bad':
                reject('mock error');
                break;
            }
          });
        }
      }
    })
  }
});

/**
 * Mock the behavior of JwtTools
 */
let validToken: any;
const cookie_invalidation = `${JwtTools.COOKIE_NAME}=invalidated; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly`;
jest.mock('../Jwt', () => {
  const originalModule = jest.requireActual('../Jwt') as JwtTools;
  if(process.env?.unmocked === 'true') {
    return originalModule;
  }
  return {
    JwtTools: jest.fn().mockImplementation(() => {
      return {
        __esModule: true,
        ...originalModule, 
        resetPrivateKey: (key:string) => jest.fn(),
        resetPublicKey: (key:string) => jest.fn(),
        hasValidToken: (request:any):any => {
          return validToken;
        },
        setCookieInResponse: (response:any, payload:any) => {
          response.headers['set-cookie'] = [{ 
            key: 'Set-Cookie', 
            value: `${JwtTools.COOKIE_NAME}=dummy_token_value; dummy_serialized_opts` 
          }];
        },
        setCookieInvalidationInResponse: (response:any) => {
          response.headers['set-cookie'] = [{
            key: 'Set-Cookie',
            value: cookie_invalidation
          }];
        }
      }
    })
  }
});

const getMockConfig = ():IConfig => {
  return {
    appLoginHeader: 'dummy_app_login_header',
    appLogoutHeader: 'dummy_app_logout_header',
    appAuthorization: false,
    domain,
    samlParms: {
      cert: 'dummy_cert',
      key: 'dummy_pk',
      entityId: 'dummy_entity_id',
      entryPoint: 'dummy_entry_point',
      idpCert: 'dummy_idp_cert',
      logoutUrl: 'dummy_logout_url'
    },
    jwtPrivateKeyPEM: 'dummy_pvt_jwt_key',
    jwtPublicKeyPEM: 'dummy_pub_jwt_key'
  } as IConfig;
}

const getMockRequest = ():IRequest => {
  const data = 'some random string';
  return {
    body: { 
      data: `${btoa(data)}`
    },
    headers: {
      host: [ { key: 'Host', value: 'wp3ewvmnwp5nkbh3ip4qulkwyu0qoglu.lambda-url.us-east-1.on.aws' } ],
      origin: [ { key: 'origin', value: 'https://localhost/me/at/my/laptop' } ],
      TEST_SCENARIO: [] as any,
      cookie: [] as any
    },
    headerActivity: { added: {}, modified: {}, removed: {} },
    method: 'GET',
    querystring: '',
    uri
  } as IRequest; 
}

/**
 * Get a header value from a response object, specified by name.
 * @param response 
 * @param name 
 * @returns 
 */
const getHeaderValue = (response:IResponse, name:string): any|null => {
  if( ! response || ! response.headers) return null;
  return Headers(response).get(name);
}

/**
 * Search the response for a specified header with a specified value
 */
const responseHasHeaderValue = (response:IResponse, name:string, value:string): string|null => {
  return getHeaderValue(response, name) == value ? value : null; 
}

/**
 * Search the response for a specified header with a value whose value starts with the specified value
 */
const responseHasHeaderWithValueStartingWith = (response:IResponse, name:string, valueSegment:string): string|null => {
  const value = getHeaderValue(response, name) as string;
  return value.startsWith(valueSegment) ? value : null;
};

/**
 * Test all endpoints of authentication flow for the sp.
 * Also assert that the flow changes where necessary when the app is configured to "decide" authentication requirement. 
 */
describe('HandlerSp.handler', () => {

  it('Should redirect to the login path if the original path is to the app and no valid JWT token', async () => {
    validToken = null;
    const mockConfig:IConfig = getMockConfig();
    const mockRequest:IRequest = getMockRequest();

    // The sp will blanket require every request to be authenticated.
    mockConfig.appAuthorization = false;
    let response = await handler(mockRequest, mockConfig) as any;
    expect(response.status).toEqual('302');
    const location = getHeaderValue(response, 'location');
    const url = new URL(location);
    expect(url.host).toEqual(domain);
    expect(url.pathname).toEqual('/login');      
    const qsparms = new URLSearchParams(url.searchParams);
    const relayState = decodeURIComponent(qsparms?.get('relay_state') || '');
    expect(relayState).toEqual(`https://${domain}${uri}`);

    // The sp will delegate to the app for authentication decisions.
    mockConfig.appAuthorization = true;
    response = await handler(mockRequest, mockConfig) as any;
    // Get a clone of the request in the event object
    const expectedResponse = getMockRequest() as any;
    // Modify the request the same way it is expected that the handler will
    expectedResponse.headers.authenticated = [{ key: 'authenticated', value: 'false'}];
    expectedResponse.headerActivity.added.authenticated = [{ key: 'authenticated', value: 'false'}];
    expectedResponse.headers.login = [{ key: 'login', value: AUTH_PATHS.LOGIN}];
    expectedResponse.headerActivity.added.login = [{ key: 'login', value: AUTH_PATHS.LOGIN}];

    const encodedRS = encodeURIComponent(relayState);
    const encodedLoginHdr = encodeURIComponent(`https://${domain}${AUTH_PATHS.LOGIN}?relay_state=${encodedRS}`);
    expectedResponse.headers.dummy_app_login_header = [{ key: 'dummy_app_login_header', value: encodedLoginHdr }];
    expectedResponse.headerActivity.added.dummy_app_login_header = [{ key: 'dummy_app_login_header', value: encodedLoginHdr }];
    
    const encodedLogoutHdr = encodeURIComponent(`https://${domain}${AUTH_PATHS.LOGOUT}`);
    expectedResponse.headers.dummy_app_logout_header = [{ key: 'dummy_app_logout_header', value: encodedLogoutHdr}];
    expectedResponse.headerActivity.added.dummy_app_logout_header = [{ key: 'dummy_app_logout_header', value: encodedLogoutHdr}];

    // Assert equality   
    expect(response).toEqual(expectedResponse);
  });

  it('Should terminate if the original path is to the app, no JWT token, and an "after_auth" parameter is "true"', async () => {
    validToken = null;
    const mockConfig:IConfig = getMockConfig();
    const mockRequest:IRequest = getMockRequest();
    mockRequest.uri = '/some/path';
    mockRequest.querystring = 'after_auth=true';

    const assert = () => {
      expect(response).toBeDefined();
      expect(response.status).toEqual('500');
      expect(responseHasHeaderValue(response, 'content-type', 'text/plain'));
      expect(response.body).toEqual('Authentication should have resulted in a valid JWT - no valid token found');
    }

    mockConfig.appAuthorization = false;
    let response = await handler(mockRequest, mockConfig) as IResponse;
    assert();

    // Should behave the same.
    mockConfig.appAuthorization = true;
    response = await handler(mockRequest, mockConfig) as IResponse;
    assert();
  });

  it('Should redirect to the IDP for authentication if uri is login path', async () => {
    const mockConfig:IConfig = getMockConfig();
    const mockRequest:IRequest = getMockRequest();
    mockRequest.uri = AUTH_PATHS.LOGIN;
    mockRequest.headers.origin = [ { key: 'origin', value: `https://${domain}` } ];

    const assert = () => {
      expect(response).toBeDefined();
      expect(response.status).toEqual('302');
      expect(responseHasHeaderWithValueStartingWith(
        response, 
        'location', 
        'https://shib-test.bu.edu/idp/profile/SAML2/Redirect/SSO?SAMLRequest=')).toBeTruthy();
    }

    mockConfig.appAuthorization = false;
    let response = await handler(mockRequest, mockConfig) as IResponse;
    assert();

    // Should behave the same.
    mockConfig.appAuthorization = true;
    response = await handler(mockRequest, mockConfig) as IResponse;
    assert();
  });

  it('Should handle an incoming saml response request from the IDP by performing assertion', async () => {
    const mockConfig:IConfig = getMockConfig();
    const mockRequest:IRequest = getMockRequest();
    mockRequest.uri = AUTH_PATHS.ASSERT;
    mockRequest.headers.origin = [ { key: 'origin', value: `https://shib-test.bu.edu` } ];

    // Test the scenario in which the assertion attempt errors out:
    const testScenario1 = async () => {
      mockRequest.headers.TEST_SCENARIO[0] = { key: 'assert_result', value: 'bad' };
      
      const assert = () => {
        expect(response).toBeDefined();
        expect(response.status).toEqual('500');
      }

      mockConfig.appAuthorization = false;
      let response = await handler(mockRequest, mockConfig) as IResponse;
      assert();

      // Should behave the same;
      mockConfig.appAuthorization = true;
      response = await handler(mockRequest, mockConfig) as IResponse;
      assert();
    }

    // Test the scenario in which the assertion attempt is successful:
    const testScenario2 = async () => {
      mockRequest.headers.TEST_SCENARIO[0] = { key: 'assert_result', value: 'good' };

      const assert = () => {
        expect(response).toBeDefined();
        expect(response.status).toEqual('302');
        const relayState = `https://${domain}${uri}`;
        const redirectUrl = `${relayState}?after_auth=true`;
        expect(responseHasHeaderValue(response, 'location', redirectUrl));
        const cookie = getHeaderValue(response, 'set-cookie');
        expect(cookie).not.toBeNull();
      }

      mockConfig.appAuthorization = false;
      let response = await handler(mockRequest, mockConfig) as IResponse;
      assert();

      // Should behave the same;
      mockConfig.appAuthorization = true;
      response = await handler(mockRequest, mockConfig) as IResponse;
      assert();
    }

    await testScenario1();

    await testScenario2();
  });

  it('Should simply forward to the origin if a valid token in header', async () => {
    // At this point in the auth flow, the assert callback is taking place and a token should be present as a header:
    validToken = {
      [JwtTools.TOKEN_NAME]: {
        sub: MockSamlAssertResponse.user.name_id, 
        user: MockSamlAssertResponse.user.attributes
      }
    };
    const mockConfig:IConfig = getMockConfig();
    const mockRequest:IRequest = getMockRequest();
    const originalHeaders:RequestHeaders = getMockRequest().headers;

    const assert = () => {
      // Assert that all the original headers are retained in the response:
      expect(response.headers).toEqual(
        expect.objectContaining(originalHeaders)
      );
      // Assert that the headers the event was supposed to add are also present:
      const hdrs = Headers(response)
      expect(hdrs.get('authenticated')).toEqual('true');
      expect(hdrs.get('user-details')).toBeDefined();
      expect(hdrs.get(mockConfig.appLoginHeader)).toBeDefined();
      expect(hdrs.get('eduPersonAffiliation')).toBeDefined();
      expect(hdrs.get('eduPersonEntitlement')).toBeDefined();
      expect(hdrs.get('eduPersonPrincipalName')).toBeDefined();
      expect(hdrs.get('buPrincipal')).toBeDefined();
    }

    mockConfig.appAuthorization = false;
    let response = await handler(mockRequest, mockConfig) as IResponse;
    assert();

    mockConfig.appAuthorization = true;
    response = await handler(mockRequest, mockConfig) as IResponse;
    assert();
  });

  it('Should respond to initial logout with jwt invalidation and redirect back for step two', async () => {
    const mockConfig:IConfig = getMockConfig();
    const mockRequest:IRequest = getMockRequest();
    mockRequest.uri = AUTH_PATHS.LOGOUT;

    const assert = () => {
      expect(response.status).toEqual('302');
      expect(responseHasHeaderValue(response, 'set-cookie', cookie_invalidation)).toBeTruthy();
      expect(responseHasHeaderValue(response, 'location', `https://${domain}/logout?target=idp`)).toBeTruthy();
    }

    mockConfig.appAuthorization = false;
    let response = await handler(mockRequest, mockConfig) as any;
    assert();

    // Should behave the same;
    mockConfig.appAuthorization = true;
    response = await handler(mockRequest, mockConfig) as any;
    assert();
});

  it('Should respond to the secondary logut with redirect to the IDP for logout', async () => {
    const mockConfig:IConfig = getMockConfig();
    const mockRequest:IRequest = getMockRequest();
    mockRequest.uri = AUTH_PATHS.LOGOUT;
    mockRequest.querystring = 'target=idp';

    const assert = () => {
      expect(response.status).toEqual('302');
      expect(responseHasHeaderValue(response, 'location', logoutUrl)).toBeTruthy();
    }

    mockConfig.appAuthorization = false;
    let response = await handler(mockRequest, mockConfig) as any;
    assert();

    // Should behave the same;
    mockConfig.appAuthorization = true;
    response = await handler(mockRequest, mockConfig) as any;
    assert();
  });
});
