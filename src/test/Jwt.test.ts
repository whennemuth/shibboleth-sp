import { CookieOptions, JwtTools, hostIsWithinCookieDomain } from '../Jwt';
import { Keys } from '../Keys';
import { IRequest } from '../Http';

const jwtTools = new JwtTools();
const keys = new Keys();
jwtTools.resetPrivateKey(keys.privateKeyPEM);
jwtTools.resetPublicKey(keys.publicKeyPEM);
const mockResponse = {
  headers: { } as any
};
const payload = {
  sub: '4a736c2c-1aac-4762-ad10-69ed04ba2185',
  email: 'daffy@warnerbros.com'
};
const mockRequest = {
  clientIp: '',
  method: '',
  uri: '',
  querystring: '',
  body: { data: '' },
  headers: {
    "user-agent": [],
    "user-name": [],
    host: [],
    cookie: []
  },
  headerActivity: { added: {}, modified: {}, removed: {} },
} as IRequest;

describe('Jwt', () => {
  let cookieHeader:any;     

  it('Should set the cookie in the response', () => {
    jwtTools.setCookieInResponse(mockResponse, payload);
    cookieHeader = mockResponse.headers['set-cookie'];

    expect(cookieHeader).toBeDefined();
    expect(cookieHeader.length).toEqual(1);
    expect(cookieHeader[0].key).toEqual('Set-Cookie');
  });

  it('Should see the token in the cookie as verifiable', () => {
    const authToken = cookieHeader[0].value.split(';')[0].split('=')[1];
    (mockRequest.headers as Headers|any).cookie.push({
      key: 'Cookie',
      value: `${JwtTools.COOKIE_NAME}=${authToken}`
    });
    expect(jwtTools.hasValidToken(mockRequest)).toBeTruthy();
  });

  it('Should NOT verify an expired token', () => {
    const week = 1000 * 60 * 60 * 24 * 7;
    const weekFromNow = Math.floor((Date.now() + week)/1000);
    jwtTools.setClockTime(weekFromNow);
    jwtTools.setCookieInResponse(mockResponse, payload);
    expect(jwtTools.hasValidToken(mockRequest)).toBeFalsy();
  })
});

describe('Jwt cookie options', () => {
  const requestWithCookies = (cookieHeaderValue:string):IRequest => {
    return { ...mockRequest, headers: { cookie: [ { key: 'Cookie', value: cookieHeaderValue } ] } } as any;
  }
  const setCookieValue = (tools:JwtTools, invalidate?:boolean):string => {
    const response = { headers: { } as any };
    if(invalidate) {
      tools.setCookieInvalidationInResponse(response);
    }
    else {
      tools.setCookieInResponse(response, payload);
    }
    return response.headers['set-cookie'][0].value;
  }
  const newTools = (options?:CookieOptions):JwtTools => {
    const tools = new JwtTools(options);
    tools.resetPrivateKey(keys.privateKeyPEM);
    tools.resetPublicKey(keys.publicKeyPEM);
    return tools;
  }

  it('Should default to a host-only cookie with the default name', () => {
    const tools = newTools();
    expect(tools.getCookieName()).toEqual(JwtTools.COOKIE_NAME);
    expect(tools.getCookieDomain()).toBeUndefined();
    const value = setCookieValue(tools);
    expect(value.startsWith(`${JwtTools.COOKIE_NAME}=`)).toBeTruthy();
    expect(value).not.toContain('Domain=');
    expect(setCookieValue(tools, true)).not.toContain('Domain=');
  });

  it('Should set and invalidate the cookie with the configured name and domain', () => {
    const tools = newTools({ cookieName: 'shared-auth', cookieDomain: 'apps.example.edu' });
    const value = setCookieValue(tools);
    expect(value.startsWith('shared-auth=')).toBeTruthy();
    expect(value).toMatch(/; Max-Age=604800; Domain=apps\.example\.edu; Secure; HttpOnly$/);
    expect(setCookieValue(tools, true)).toEqual(
      'shared-auth=invalidated; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Domain=apps.example.edu; Secure; HttpOnly'
    );
  });

  it('Should read only the cookie with the configured name', () => {
    const shared = newTools({ cookieName: 'shared-auth', cookieDomain: 'apps.example.edu' });
    const hostOnly = newTools();
    const sharedToken = setCookieValue(shared).split(';')[0].split('=')[1];

    // The shared cookie is found by its own name only...
    expect(shared.hasValidToken(requestWithCookies(`other=1; shared-auth=${sharedToken}`))).toBeTruthy();
    expect(hostOnly.hasValidToken(requestWithCookies(`shared-auth=${sharedToken}`))).toBeFalsy();

    // ...and a cookie under the default name is ignored when another name is configured.
    expect(shared.hasValidToken(requestWithCookies(`${JwtTools.COOKIE_NAME}=${sharedToken}`))).toBeFalsy();
  });

  it('Should reject a cookie name or domain that would corrupt the set-cookie header', () => {
    expect(() => new JwtTools({ cookieName: 'bad name' })).toThrow('Invalid cookie name');
    expect(() => new JwtTools({ cookieName: 'a;b' })).toThrow('Invalid cookie name');
    expect(() => new JwtTools({ cookieName: 'a=b' })).toThrow('Invalid cookie name');
    expect(() => new JwtTools({ cookieDomain: 'example.edu; Path=/x' })).toThrow('Invalid cookie domain');
    expect(() => new JwtTools({ cookieDomain: 'https://example.edu' })).toThrow('Invalid cookie domain');
    expect(() => new JwtTools({ cookieName: 'hp-dashboard-auth', cookieDomain: '.apps.example.edu' })).not.toThrow();
  });

  it('Should tell whether a host is within a cookie domain', () => {
    expect(hostIsWithinCookieDomain('apps.example.edu', 'apps.example.edu')).toBeTruthy();
    expect(hostIsWithinCookieDomain('app1.apps.example.edu', 'apps.example.edu')).toBeTruthy();
    expect(hostIsWithinCookieDomain('app1.apps.example.edu:8443', 'apps.example.edu')).toBeTruthy();
    expect(hostIsWithinCookieDomain('App1.Apps.Example.edu', '.apps.example.edu')).toBeTruthy();
    expect(hostIsWithinCookieDomain('app1.otherapps.example.edu', 'apps.example.edu')).toBeFalsy();
    expect(hostIsWithinCookieDomain('example.edu', 'apps.example.edu')).toBeFalsy();
  });
});
