import { getDockerConfigFromEnvironment, IConfig } from "./Config";
import { getHost, IRequest } from "./Http";

export type HostType = {
  getPublicHostOrigin: (request?:IRequest) => URL;
  getPublicHostUrl: (request:IRequest) => URL;
  getInternalDockerAppHostUrl: (request?: IRequest) => URL;
}

export const Host = (config:IConfig): HostType => {

  const { domain } = config;
  const { appHostname, appPort, spPort, isDockerCompose } = getDockerConfigFromEnvironment();

  const getPublicHostOrigin = (request?:IRequest):URL => {
    // Just start off with a basic localhost URL
    const url = new URL('http://localhost');

    // The public URL will always be https, so we can set that here.
    url.protocol = 'https';

    // Favor the domain from the config, but if not set, default with the request host
    if(domain) {
      url.hostname = domain;
    }
    else if(request) {
      const host = getHost(request);
      if(host) {
        url.hostname = host;
      }
    }

    // If the port is not the default for https or http, we need to set it
    if(spPort != 443 && spPort != 80) {
      url.port = spPort.toString();
    }

    return url;
  }

  /**
   * The relay state URL is based on the public host URL, but it will include the request URI and query string 
   * if provided. This is used to redirect the user back to the original request after authentication.
   * @param request 
   * @returns 
   */
  const getPublicHostUrl = (request:IRequest):URL => {
    const url = getPublicHostOrigin(request);
    if(request.uri) {
      url.pathname = request.uri;
    }
    if(request.querystring) {
      url.search = request.querystring;
    }
    return url;
  }

  /**
   * Get the url that the sp container must use to access the app container over the internal docker network.
   * The protocol will default to http, which assumes the target app is not running the ssl termination itself,
   * but is simulating a real-life situation in which that is perhaps happening in a reverse proxy like nginx, 
   * or cloudfront if running in AWS.
   * @param pathname 
   * @returns 
   */
  const getInternalDockerAppHostUrl = (request?:IRequest):URL => {
    // Just start off with a basic localhost URL
    const url = new URL('http://localhost');

    // Configure the URL based on the environment
    url.protocol = appPort === 443 ? 'https:' : 'http:';
    if(appHostname) {
      url.hostname = appHostname;
    }
    if( appPort && appPort != 443 && appPort != 80) {
      url.port = appPort.toString();
    }
    if(request) {
      if(request.uri && request.uri !== '/') {
        url.pathname = request.uri;
      }
      if(request.querystring) {
        url.search = request.querystring;
      }
    }

    // Return the formatted URL
    return url;
  }

  /**
   * We must be running as a vscode launch configuration (not docker), so countermand the APP_AUTHORIZATION
   * variable because there is no app container to proxy to for delegating the authentication decisions to.
   */
  if( ! appHostname) {
    config.appAuthorization = false;
  }


  return {
    getPublicHostOrigin,
    getPublicHostUrl,
    getInternalDockerAppHostUrl
  };
}