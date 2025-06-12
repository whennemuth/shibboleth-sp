import { KeyValuePair } from "./Http";
import { Keys } from "./Keys";
import { SamlToolsParms } from "./Saml";


/**
 * A type that accounts for ALL configurable values.
 */
export type IConfig = {
  /**
   * The domain for requests to the app that shibboleth-sp is "listening" to. All http(s) requests will be made
   * to this domain. This is the domain that the browser will use to access the app and relay_state urls will be
   * constructed using this domain.
   */
  domain:string,
  /**
   * The name of a header shibboleth-sp will apply to requests. Apps will look for this header when redirecting 
   * for login.
   */
  appLoginHeader:string,
  /**
   * The name of a header shibboleth-sp will apply to requests. Apps will look for this header when redirecting 
   * for logout.
   */
  appLogoutHeader:string,
  /**
   * True indicates the standard mode for authentication flow. False indicates the basic mode. See the README.md
   * for more information on these modes.
   */
  appAuthorization:boolean,
  /**
   * See @SamlToolsParms for more information on these parameters.
   */
  samlParms:SamlToolsParms
  /**
   * A private key for JSON web token (JWT) generation. If not provided, one will be generated that lasts as 
   * long as the application process is running, which would make sense in a testing scenario.
   */
  jwtPrivateKeyPEM?:string,
  /**
   * A public key for JSON web token (JWT) generation. If not provided, one will be generated that lasts as 
   * long as the application process is running, which would make sense in a testing scenario.
   */
  jwtPublicKeyPEM?:string,
  /**
   * A way to inject those headers that one wishes sp-shibboleth to append to incoming reqests. 
   * Currently not available as environment variable(s).
   */
  customHeaders?:KeyValuePair[];
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
    JWT_PUBLIC_KEY_PEM:jwtPublicKeyPEM
  } = process.env;

  // If JWT keys are not in the environment, then generate them.
  if( ! jwtPrivateKeyPEM && ! jwtPublicKeyPEM) {
    const { privateKeyPEM, publicKeyPEM } = new Keys();
    jwtPrivateKeyPEM = privateKeyPEM;
    jwtPublicKeyPEM = publicKeyPEM;
  }

  return {
    domain, appLoginHeader, appLogoutHeader, jwtPrivateKeyPEM, jwtPublicKeyPEM,
    appAuthorization: `${appAuthorization}`.toLowerCase() == 'false' ? false : true,
    samlParms: {
      entityId, entryPoint, logoutUrl, idpCert, cert, key
    }
  } as IConfig;
}

/**
 * A type that accounts for only those configurable values that are needed when running in Docker compose.
 */
export type IDockerConfig = {
  /**
   * This is the port that the "sp" container will bind to the host machine. This is the port that all requests
   * from the browser must use as they all need to pass through the "sp" container.
   */
  spPort:number,
  /**
   * This is the port that the "app" container will expose and the "sp" container will proxy to using axios requests.
   * Use "443" if you want the "app" container to expect https traffic and use ssl.
   */
  appPort?:number,
  /**
   * This is the name of the hostname of the "app" container as published on the Docker network. 
   * This will be the same name as the service element in the docker-compose.yml file.
   */
  appHostname?:string,
  /**
   * If at least spPort has a value, then we must be running in Docker compose.
   */
  isDockerCompose:() => boolean
}

/**
 * @returns An instance of IDockerConfig whose values are ALL obtained from the environment.
 */
export const getDockerConfigFromEnvironment = ():IDockerConfig => {
  let {
    DOCKER_SP_PORT:spPort,
    DOCKER_APP_PORT:appPort,
    DOCKER_APP_HOST:appHostname
  } = process.env;

  const cfg = { appHostname } as IDockerConfig;
  if(spPort && !isNaN(parseInt(spPort))) {
    cfg.spPort = parseInt(spPort);
  }
  if(appPort && !isNaN(parseInt(appPort))) {
    cfg.appPort = parseInt(appPort);
  }
  cfg.isDockerCompose = () => {
    // spPort is a minimum requirement for running in Docker compose. If it is not set, then we are not 
    // running in Docker compose (though may still be running "locally" from a vscode launch configuration).
    return !!cfg.spPort;
  };

  // If not isDockerCompose, then what is returned here as defaults probably has no use, but return it anyway in case.
  return cfg;
}