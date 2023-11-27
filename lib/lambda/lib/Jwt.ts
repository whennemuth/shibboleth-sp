import * as jwt from 'jsonwebtoken';
import ms, { StringValue } from 'ms';

/**
 * Use the jsonwebtoken library to create and verify jwts.
 * https://www.npmjs.com/package/jsonwebtoken
 */
export class JwtTools {

  private publicKey:string;
  private privateKey:string;
  private expiresIn:StringValue = '7d';
  private clockTime:number|undefined;

  public static TOKEN_NAME:string = 'auth-token';
  public static COOKIE_NAME:string = `${JwtTools.TOKEN_NAME}-cookie`;

  public resetPrivateKey(privateKey:string) {
    this.privateKey = privateKey;
  }
  public resetPublicKey(publicKey:string) {
    this.publicKey = publicKey;
  }
  public setExpiration(expiresIn:string) {
    this.expiresIn = expiresIn as StringValue;
  }
  public setClockTime(clockTime:number) {
    this.clockTime = clockTime;
  }

  public hasValidToken(request:any):boolean {
    try {
      if(request.headers[JwtTools.COOKIE_NAME]) {
        let authToken:string = request.headers[JwtTools.COOKIE_NAME][0].value;
        if(authToken.includes(';')) 
          authToken = authToken.split(';')[0];
        if(authToken.includes('='))
          authToken = authToken.split('=')[1];
        const verification = jwt.verify(authToken, this.publicKey, {
          algorithms: ['RS256'],
          clockTimestamp: this.clockTime
        });
        // If no error is thrown, then the token is valid
        return true;
      }
      return false;
    } 
    catch (error) {
      return false;
    }
  }

  public setCookieInResponse(response:any, payload:any) {
    const jwtCookieOptions = {
      maxAge: Math.floor(ms(this.expiresIn)/1000), // expiresIn, in seconds
      httpOnly: true,
      secure: true,
    };

    const jwtToken = jwt.sign({ [JwtTools.TOKEN_NAME]: payload }, this.privateKey, {
      algorithm: 'RS256',
      expiresIn: this.expiresIn,
    });

    const serializedOpts = Object.entries(jwtCookieOptions).map(([key, value]) => `${key}=${value}`).join('; ');

    response.headers['set-cookie'] = [{ 
      key: 'Set-Cookie', 
      value: `${JwtTools.COOKIE_NAME}=${jwtToken}; ${serializedOpts}` 
    }];
  }
}