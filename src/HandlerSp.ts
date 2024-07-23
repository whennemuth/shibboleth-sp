import { SamlTools, SendAssertResult } from './Saml';
import { JwtTools } from './Jwt';
import { debugPrint } from './Utils';
import { IConfig } from './Config';
import { IRequest, IResponse, KeyValuePair, Headers, addHeader } from './Http';

export enum AUTH_PATHS {
  LOGIN = '/login', LOGOUT = '/logout', ASSERT = '/assert', METADATA = '/metadata', FAVICON = '/favicon.ico'
}

export const APP_AUTHORIZATION_HEADER_NAME = 'app_authorization';

/**
 * This is the sp "switchboard operator" for origin request traffic. It will perform all saml SP operations for ensuring
 * that the user bears JWT proof of saml authentication, else it drives the authentication flow with the IDP.
 * @param event 
 * @returns Promise<IRequest|IResponse>
 *    IRequest: Returning the original request (possibly with headers added) - indicates the request is to be
 *      forwarded on to the target app.
 *    IResponse: Returning an object that indicates an error or redirection - not passing through to the target app.
 */
export const handler = async (originRequest:IRequest, config:IConfig):Promise<IRequest|IResponse> => {

  let { 
    domain, appAuthorization, appLoginHeader, appLogoutHeader, samlParms, 
    jwtPrivateKeyPEM, jwtPublicKeyPEM, customHeaders=[] as KeyValuePair[]
  } = config;

  const { querystring, uri } = originRequest;
  const headers = Headers(originRequest);
  const samlTools = new SamlTools(samlParms);
  const relayDomain = `https://${domain}`;
  samlTools.setAssertUrl(`${relayDomain}/assert`);

  const jwtTools = new JwtTools();
  jwtTools.resetPublicKey(jwtPublicKeyPEM!);
  jwtTools.resetPrivateKey(jwtPrivateKeyPEM!);
  
  // Set appAuth. True means that the target app "decides" if authentication is needed (default).
  // False means an assumption that all requests must be authenticated and that is enforced here.
  const customHdr = headers.get(APP_AUTHORIZATION_HEADER_NAME);
  if(customHdr && 'true' == customHdr) {
    appAuthorization = true;
  }

  try {
    let response;
    const qsparms = querystring ? new URLSearchParams(querystring) : null;
    console.log(`uri: ${uri}`);
    console.log(`querystring: ${querystring}`);
    const { LOGIN, LOGOUT, ASSERT, METADATA, FAVICON } = AUTH_PATHS;

    const getAppLoginUrl = ():string => {
      const relay_state = encodeURIComponent(relayDomain + uri + (querystring ? `?${querystring}` : ''));
      return `${relayDomain}${AUTH_PATHS.LOGIN}?relay_state=${relay_state}`;
    }

    const getAppLogoutUrl = ():string => `${relayDomain}${AUTH_PATHS.LOGOUT}`;

    switch(uri) {
      case LOGIN:
        console.log('User is not authenticated, initiate SAML authentication...');
        var relayState:string|null = decodeURIComponent(qsparms ? qsparms.get('relay_state') || '' : relayDomain);
        const loginUrl = await samlTools.createLoginRequestUrl(relayState);
        response = {
          status: '302',
          statusDescription: 'Found',
          headers: {
            location: [{ key: 'Location', value: loginUrl }],
          },
        } as IResponse;
        debugPrint(`response: ${JSON.stringify(response, null, 2)}`);
        break;

      case LOGOUT:
        const target = qsparms ? qsparms.get('target') : null;
        if(target == 'idp') {
          // Second step: logout with the Idp
          const logoutUrl = await samlTools.createLogoutRequestUrl();
          response = {
            status: '302',
            statusDescription: 'Found',
            headers: {
              location: [{ key: 'Location', value: logoutUrl }],
            },
          } as IResponse;
          debugPrint(`IDP logout response: ${JSON.stringify(response, null, 2)}`);  
        }
        else {
          // First step: invalidate the jwt along with a redirect to come back and logout with the IDP
          response = {
            status: '302',
            statusDescription: 'Found',
            headers: {
              location: [{ key: 'Location', value: `${relayDomain}/logout?target=idp` }],
            }
          } as IResponse;
          jwtTools.setCookieInvalidationInResponse(response);
          debugPrint(`Local logout response: ${JSON.stringify(response, null, 2)}`);  
        }
        break;

      case ASSERT:
        const result:SendAssertResult|null = await samlTools.sendAssert(originRequest);
        const message = `Authentication successful. result: ${JSON.stringify(result, null, 2)}`
        var { samlAssertResponse, relayState } = result;
        relayState = decodeURIComponent(relayState || relayDomain);
        if( ! samlAssertResponse) break;
                
        debugPrint(message);

        console.log(`relayState: ${relayState}`);
        const redirectUrl = new URL(relayState);
        redirectUrl.searchParams.append('after_auth', 'true');

        response = {
          status: '302',
          statusDescription: 'Found',
          headers: {
            location: [{ key: 'Location', value: redirectUrl.toString() }],
          },
        } as IResponse;
        const cookieValue = {
          sub: samlAssertResponse.user.name_id, 
          user: samlAssertResponse.user.attributes
        };
        console.log(`Setting JWT: ${JSON.stringify(cookieValue, null, 2)}`);
        jwtTools.setCookieInResponse(response, cookieValue);
        
        break;

      case METADATA:
        response = {
          status: '200',
          statusDescription: 'OK',
          body: samlTools.getMetaData(),
          headers: {
            'content-type': [{ key: 'Content-Type', value: 'application/xml' }],
          },
        } as IResponse;
        break;

      case FAVICON:
        // This path just dirties up logs, so intercept it here and return a blank.
        // Can't seem to get an actual favicon.ico to work from here anyway.
        response = {
          status: '200',
          statusDescription: 'OK',
        } as IResponse;   
        break;

      default:
        const afterAuth = decodeURIComponent(qsparms ? qsparms.get('after_auth') || '' : '');
        const validToken = jwtTools.hasValidToken(originRequest);

        if (validToken) {
          // Tokens are valid, so consider the user authenticated and pass through to the origin.
          console.log('Request has valid JWT');
          response = originRequest;          
          addHeader(response, 'authenticated', 'true');

          // Send the entire token in a single header
          const userDetails = `${Buffer.from(JSON.stringify(validToken, null, 2)).toString('base64')}`;
          addHeader(response, 'user-details', userDetails);

          // Also send the individual claims in separate headers, as mod_shib would.
          const { user: { eduPersonPrincipalName, buPrincipal, eduPersonAffiliation, eduPersonEntitlement } } = validToken[JwtTools.TOKEN_NAME];
          addHeader(response, 'eduPersonPrincipalName', eduPersonPrincipalName);
          addHeader(response, 'buPrincipal', buPrincipal);
          addHeader(response, 'eduPersonAffiliation', eduPersonAffiliation.join(';'));
          addHeader(response, 'eduPersonEntitlement', eduPersonEntitlement.join(';'));
          addHeader(response, appLoginHeader, encodeURIComponent(getAppLoginUrl()));
          addHeader(response, appLogoutHeader, encodeURIComponent(getAppLogoutUrl()));
          for(let i=0; i<customHeaders.length; i++) {
            const { key, value } = customHeaders[i];
            addHeader(response, key, encodeURIComponent(value))
          }

          console.log(`Valid JWT found - passing through to origin: ${JSON.stringify(response, null, 2)}`);
        }
        else if(afterAuth.toLocaleLowerCase() === 'true') {
          // The saml exchange has just taken place, and the user has authenticated with the IDP, yet either
          // the JWT did not make it into a cookie, or the cookie value did not make it into the header of 
          // this request. In either case, we don't redirect back to the login path to try again, because this
          // will most likely result in an endless loop. Just terminate with an error.
          response = {
            status: '500',
            statusDescription: 'State Error',
            body: 'Authentication should have resulted in a valid JWT - no valid token found',
            headers: {
              'content-type': [{ key: 'Content-Type', value: 'text/plain' }],
            }
          }
          console.log(`No valid JWT found after authentication: ${JSON.stringify(response, null, 2)}`); 
        }
        else if(appAuthorization) {
          // The application will "decide" if access to it needs to be authenticated or not, so just pass through the request
          response = originRequest;
          addHeader(response, 'authenticated', 'false');
          addHeader(response, 'login', LOGIN);
          addHeader(response, appLoginHeader, encodeURIComponent(getAppLoginUrl()));
          addHeader(response, appLogoutHeader, encodeURIComponent(getAppLogoutUrl()));
          for(let i=0; i<customHeaders.length; i++) {
            const { key, value } = customHeaders[i];
            addHeader(response, key, encodeURIComponent(value))
          }

          console.log('App will determine need for auth - passing through to origin');
        } 
        else {
          // No valid token has been found, and this is not a post authentication redirect - send user to login.
          response = {
            status: '302',
            statusDescription: 'Found',
            headers: {
              location: [{ key: 'Location', value: getAppLoginUrl() }],
            },
          } as IResponse;
          console.log(`No valid JWT found - redirecting: ${JSON.stringify(response, null, 2)}`); 
        }
        break;
    }
    
    return response as IRequest|IResponse;
  } 
  catch (error:any) {
    // Handle authentication error
    console.error('SP error:', error);
    return {
      status: '500',
      statusDescription: 'Server Error',
      body: `${JSON.stringify({ message: error.message, stack: error.stack }, null, 2)}`,
      headers: {
        'content-type': [{ key: 'Content-Type', value: 'text/plain' }],
        // 'www-authenticate': [{ key: 'WWW-Authenticate', value: 'Basic' }],
      },
    };
  }
};




