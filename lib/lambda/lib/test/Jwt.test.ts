import { JwtTools } from '../Jwt';
import { Keys } from '../Keys';
import { Request } from '../SimpleRemoteCall'

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
  headers: {
    "user-agent": [],
    "user-name": [],
    host: [],
    cookie: []
  }
} as Request;

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
