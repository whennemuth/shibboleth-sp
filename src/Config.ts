import { KeyValuePair } from "./Http";
import { Keys } from "./Keys";
import { SamlParms } from "./Saml";


/**
 * A type that accounts for ALL configurable values.
 * 
 * @property domain - The domain for app requests (browser access domain)
 * @property appLoginHeader - Header name for login redirects
 * @property appLogoutHeader - Header name for logout redirects  
 * @property appAuthorization - True for standard mode, false for basic mode
 * @property samlParms - SAML configuration parameters
 * @property jwtPrivateKeyPEM - Optional private key for JWT generation
 * @property jwtPublicKeyPEM - Optional public key for JWT generation
 * @property customHeaders - Optional custom headers to append to requests
 * @property cookieName - Optional name for the jwt cookie (default: "auth-token-cookie")
 * @property cookieDomain - Optional parent domain for the jwt cookie, so one sign-in is honored by every
 * app beneath it that shares the jwt keys (default: none - the cookie is host-only). Must contain domain.
 */
export interface IConfig {
  domain: string;
  appLoginHeader: string;
  appLogoutHeader: string;
  appAuthorization: boolean;
  samlParms: SamlParms;
  jwtPrivateKeyPEM?: string;
  jwtPublicKeyPEM?: string;
  customHeaders?: KeyValuePair[];
  cookieName?: string;
  cookieDomain?: string;
}

/**
 * @returns An instance of IConfig whose values are ALL obtained from the environment.
 */
export const getConfigFromEnvironment = () => {
  let {
    DOMAIN:domain='localhost',
    APP_LOGIN_HEADER:appLoginHeader, 
    APP_LOGOUT_HEADER:appLogoutHeader,
    APP_AUTHORIZATION:appAuthorization='false',
    ENTITY_ID:entityId, 
    ENTRY_POINT:entryPoint, 
    LOGOUT_URL:logoutUrl, 
    IDP_CERT:idpCert,
    SAML_CERT:cert,
    SAML_PK:key,
    JWT_PRIVATE_KEY_PEM:jwtPrivateKeyPEM,
    JWT_PUBLIC_KEY_PEM:jwtPublicKeyPEM,
    COOKIE_NAME:cookieName,
    COOKIE_DOMAIN:cookieDomain
  } = process.env;

  // If JWT keys are not in the environment, then generate them.
  if( ! jwtPrivateKeyPEM && ! jwtPublicKeyPEM) {
    const { privateKeyPEM, publicKeyPEM } = new Keys();
    jwtPrivateKeyPEM = privateKeyPEM;
    jwtPublicKeyPEM = publicKeyPEM;
  }

  return {
    domain, appLoginHeader, appLogoutHeader, jwtPrivateKeyPEM, jwtPublicKeyPEM, cookieName, cookieDomain,
    appAuthorization: `${appAuthorization}`.toLowerCase() == 'false' ? false : true,
    samlParms: {
      entityId, entryPoint, logoutUrl, idpCert, cert, key
    }
  } as IConfig;
}