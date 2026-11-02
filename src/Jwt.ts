import jwt from 'jsonwebtoken';
import ms, { StringValue } from 'ms';
import { IRequest } from './Http';

/**
 * Optional overrides for the cookie that carries the jwt.
 *
 * @property cookieName - The cookie's name. Default: JwtTools.COOKIE_NAME ("auth-token-cookie").
 * @property cookieDomain - A parent domain to scope the cookie to, so that the browser sends it to every
 * host beneath that domain, not just the one that set it (e.g. "apps.example.edu" for a cookie set by
 * "app1.apps.example.edu" that "app2.apps.example.edu" should also receive). Default: none, which makes
 * the cookie host-only.
 */
export type CookieOptions = {
  cookieName?: string;
  cookieDomain?: string;
}

// RFC 6265 cookie-name token: no whitespace, separators or control characters.
const COOKIE_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
// Dot-separated hostname labels; a leading dot is allowed, and ignored by browsers.
const COOKIE_DOMAIN_PATTERN = /^\.?[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*$/;

/**
 * Determine if a browser would accept a cookie with the specified Domain attribute from the specified host,
 * that is, if the host is the domain itself or a subdomain of it.
 * @param host The host that sets the cookie (a port, if any, is ignored)
 * @param cookieDomain The Domain attribute of the cookie
 * @returns
 */
export const hostIsWithinCookieDomain = (host:string, cookieDomain:string):boolean => {
  const _host = host.split(':')[0].toLowerCase();
  const _domain = cookieDomain.replace(/^\./, '').toLowerCase();
  return _host === _domain || _host.endsWith(`.${_domain}`);
}

/**
 * Use the jsonwebtoken library to create and verify jwts.
 *
 * @see https://www.npmjs.com/package/jsonwebtoken
 */
export class JwtTools {

  private publicKey:string;
  private privateKey:string;
  private expiresIn:StringValue = '7d';
  private clockTime:number|undefined;
  private cookieName:string;
  private cookieDomain:string|undefined;

  public static TOKEN_NAME:string = 'auth-token';
  public static COOKIE_NAME:string = `${JwtTools.TOKEN_NAME}-cookie`;

  constructor(options:CookieOptions = {}) {
    const { cookieName, cookieDomain } = options;
    if(cookieName && ! COOKIE_NAME_PATTERN.test(cookieName)) {
      throw new Error(`Invalid cookie name: "${cookieName}"`);
    }
    if(cookieDomain && ! COOKIE_DOMAIN_PATTERN.test(cookieDomain)) {
      throw new Error(`Invalid cookie domain: "${cookieDomain}"`);
    }
    this.cookieName = cookieName || JwtTools.COOKIE_NAME;
    this.cookieDomain = cookieDomain || undefined;
  }

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
   * The cookie header is a concatenation of name=value pairs delimited by a ";" character.
   * Get the value of one of these pairs, specified by name.
   * @param request The HTTP request containing cookies
   * @param cookieName The name of the cookie to retrieve
   * @returns The cookie value if found, undefined otherwise
   */
  public parseCookieValue(request:IRequest, cookieName:string) {
    let { cookie:cookieHeader } = request.headers;
    if(cookieHeader) {
      let cookieHdrVal:string|undefined;
      if(typeof cookieHeader != 'string') {
        cookieHdrVal = cookieHeader[0].value;
      }
      const cookies = cookieHdrVal ? cookieHdrVal.split(';') : [];
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
   * was provided with the http request.
   * @example
   * IMPERSONATE_buPrincipal=wrh
   * IMPERSONATE_eduPersonPrincipalName=wrh@bu.edu
   * IMPERSONATE_eduPersonAffiliation=employee|member|staff
   * @returns JWT token object with impersonation attributes, or null if no IMPERSONATE_ environment variables are found
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

  /**
   * Extract the decoded JWT from the larger cookie value.
   * @param request 
   * @param verify 
   * @returns 
   */
  public getToken(request:IRequest, verify?:boolean):any {
    try {
      const impersonationToken = this.getImpersonationToken();
      if(impersonationToken) {
        return impersonationToken;
      }
      const { cookie } = request.headers;
      if(cookie) {
        let authToken:string|null = this.parseCookieValue(request, this.cookieName);
        if(authToken) {
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
  public hasValidToken(request:IRequest):any {
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
      value: `${this.cookieName}=${jwtToken}; Max-Age=${maxAge}${this.domainAttribute()}; Secure; HttpOnly`
    }];
  }

  /**
   * Place an expired cookie in a "set-cookie" response header. The browser only replaces a cookie whose
   * name and Domain attribute match, so this must carry the same Domain attribute the cookie was set with.
   * @param response
   */
  public setCookieInvalidationInResponse(response:any) {
    response.headers['set-cookie'] = [{
      key: 'Set-Cookie',
      value: `${this.cookieName}=invalidated; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${this.domainAttribute()}; Secure; HttpOnly`
    }];
  }

  private domainAttribute():string {
    return this.cookieDomain ? `; Domain=${this.cookieDomain}` : '';
  }

  public getCookieName():string {
    return this.cookieName;
  }
  public getCookieDomain():string|undefined {
    return this.cookieDomain;
  }
  public getTokenName():string {
    return JwtTools.TOKEN_NAME;
  }
}
