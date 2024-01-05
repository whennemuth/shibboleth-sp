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

  /**
   * Get a specific member of the cookie header.
   * @param request 
   * @param cookieName 
   * @returns 
   */
  public parseCookieValue(request:any, cookieName:string) {
    let { cookie:cookieHeader } = request.headers;
    if(cookieHeader) {
      if(typeof cookieHeader != 'string') {
        cookieHeader = cookieHeader[0].value;
      }
      const cookies = cookieHeader ? cookieHeader.split(';') : [];
      for(const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === cookieName) {
          return value;
        }
      }
    }
    
    return null;
  }

  /**
   * Any environment variable starting with "IMPERSONATE_" is treated as an attribute for building a jwt token.
   * This provides an option for mocking a jwt while running locally for testing so as to "pretend" a valid jwt 
   * was provided with the http request. Example:
   *   IMPERSONATE_buPrincipal=wrh
   *   IMPERSONATE_eduPersonPrincipalName=wrh@bu.edu
   *   IMPERSONATE_eduPersonAffiliation=employee|member|staff
   * @returns 
   */
  public getImpersonationToken():any {
    let sub:string = '';
    const attributes = { } as any;

    Object.keys(process.env).filter((e) => {
      return e.toLocaleUpperCase().startsWith('IMPERSONATE_') ? e : null;
    }).forEach((e) => {
      const attributeValue = process.env[e] as string;
      const attributeName = e.substring(e.indexOf('_')+1);
      if(attributeName.toLocaleLowerCase() === 'name_id') {
        sub = attributeValue;
      }
      else {
        attributes[attributeName] = attributeValue.split('|').map((e) => { return e.trim()});
      }
    });

    if(Object.keys(attributes).length > 0) {
      const retval = {
        [JwtTools.TOKEN_NAME]: { sub, user: { attributes} }
      };
      return retval;
    }

    return null;
  }

  public getToken(request:any, verify?:boolean):any {
    try {
      const impersonationToken = this.getImpersonationToken();
      if(impersonationToken) {
        return impersonationToken;
      }
      const { cookie } = request.headers;
      if(cookie) {
        let authToken:string = this.parseCookieValue(request, JwtTools.COOKIE_NAME);
        
        let decoded:any;
        if(verify) {
          decoded = jwt.verify(authToken, this.publicKey, {
            algorithms: ['RS256'],
            clockTimestamp: this.clockTime
          });
        }
        else {
          decoded = jwt.decode(authToken);
        }
        
        // If no error is thrown, then the token is valid
        return decoded;
      }
      return null;
    } 
    catch (error) {
      return null;
    }
  }

  /**
   * Determine if a request carries a valid jwt in its cookie header.
   * @param request 
   * @returns 
   */
  public hasValidToken(request:any):any {
    return this.getToken(request, true);
  }

  /**
   * Place a jwt in a "set-cookie" response header.
   * @param response 
   * @param payload 
   */
  public setCookieInResponse(response:any, payload:any) {
    const jwtToken = jwt.sign({ [JwtTools.TOKEN_NAME]: payload }, this.privateKey, {
      algorithm: 'RS256',
      expiresIn: this.expiresIn,
    });

    const maxAge = Math.floor(ms(this.expiresIn)/1000);
    response.headers['set-cookie'] = [{ 
      key: 'Set-Cookie', 
      value: `${JwtTools.COOKIE_NAME}=${jwtToken}; Max-Age=${maxAge}; Secure; HttpOnly` 
    }];
  }

  public setCookieInvalidationInResponse(response:any) {
    response.headers['set-cookie'] = [{
      key: 'Set-Cookie',
      value: `${JwtTools.COOKIE_NAME}=invalidated; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly`
    }];
  }

  public getCookieName():string {
    return JwtTools.COOKIE_NAME;
  }
  public getTokenName():string {
    return JwtTools.TOKEN_NAME;
  }
}
