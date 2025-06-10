import { KeyValuePair } from "./Http";
import { SamlToolsParms } from "./Saml";


/**
 * A type that accounts for ALL configurable values.
 */
export type IConfig = {
  domain:string,
  appLoginHeader:string,
  appLogoutHeader:string,
  appAuthorization:boolean,
  appPort:number,
  samlParms:SamlToolsParms
  jwtPrivateKeyPEM?:string,
  jwtPublicKeyPEM?:string,
  customHeaders?:KeyValuePair[];
}

/**
 * Get an instance of IConfig whose values are ALL obtained from the environment.
 * @returns 
 */
export const getConfigFromEnvironment = () => {
  const {
    DOMAIN:domain='localhost',
    APP_LOGIN_HEADER:appLoginHeader, 
    APP_LOGOUT_HEADER:appLogoutHeader,
    APP_AUTHORIZATION='false',
    APP_PORT=8080,
    ENTITY_ID:entityId, 
    ENTRY_POINT:entryPoint, 
    LOGOUT_URL:logoutUrl, 
    IDP_CERT:idpCert,
    SAML_CERT,
    SAML_PK,
    JWT_PRIVATE_KEY_PEM:jwtPrivateKeyPEM,
    JWT_PUBLIC_KEY_PEM:jwtPublicKeyPEM
  } = process.env;

  return {
    domain, appLoginHeader, appLogoutHeader, jwtPrivateKeyPEM, jwtPublicKeyPEM,
    appAuthorization: `${APP_AUTHORIZATION}`.toLocaleLowerCase() == 'false' ? false : true,
    appPort: APP_PORT ? parseInt(`${APP_PORT}`) : 8080,
    samlParms: {
      entityId, entryPoint, logoutUrl, idpCert, cert:SAML_CERT, key:SAML_PK
    }
  } as IConfig;
}