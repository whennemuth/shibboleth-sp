import * as jwt from 'jsonwebtoken';

/**
 * Use the jsonwebtoken library to create and verify jwts.
 * https://www.npmjs.com/package/jsonwebtoken
 */
export class JwtTools {

  private publicKey:string;
  private privateKey:string;

  public static TOKEN_NAME:string = 'auth-token';
  public static COOKIE_NAME:string = `${JwtTools.TOKEN_NAME}-cookie`;

  public resetKeyPair(privateKey:string) {
    this.privateKey = privateKey;
  }

  public resetPublicKey(publicKey:string) {
    this.publicKey = publicKey;
  }

  public hasValidToken(request:any):boolean {
    try {
      const authToken = request.headers[JwtTools.COOKIE_NAME][0].value;
      jwt.verify(authToken, this.publicKey);
      return true;
    } 
    catch (error) {
      return false;
    }
  }

  public setCookieInResponse(response:any, payload:any) {
    const jwtCookieOptions = {
      maxAge: 604800, // 7 days, in seconds
      httpOnly: true,
      secure: true,
    };

    const jwtToken = jwt.sign({ [JwtTools.TOKEN_NAME]: payload }, this.privateKey, {
      algorithm: 'RS256',
      expiresIn: "7d",
    });

    const serializedOpts = Object.entries(jwtCookieOptions).map(([key, value]) => `${key}=${value}`).join('; ');

    response.headers['set-cookie'] = [{ 
      key: 'Set-Cookie', 
      value: `${JwtTools.COOKIE_NAME}=${jwtToken}; ${serializedOpts}` 
    }];
  }
}