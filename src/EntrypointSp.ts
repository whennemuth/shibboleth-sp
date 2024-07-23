import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Request, Response } from 'express';
import { Agent, Server, createServer } from 'https';
import { IConfig, getConfigFromEnvironment } from './Config';
import { handler } from './HandlerSp';
import { Headers, IRequest, IResponse } from './Http';
import { JwtTools } from './Jwt';
import { Keys } from './Keys';
import { transformExpressRequest } from './Utils';



/**
 * Start an express server running to take all requests for authentication to the service provider endpoint.
 */
export const startExpressServer = (handler:any) => {
  // Get the sp port from the environment
  const port:number = parseInt(process.env.EXPRESS_PORT ?? '5000');

  // Get the app host value (will be supplied if running in docker and app is in another container)
  const appHost:string|undefined = process.env.DOCKER_APP_HOST;

  // Get configuration values from the environment as a consolidated object
  const config:IConfig = getConfigFromEnvironment();

  // Set domain (and port)
  let { domain, jwtPrivateKeyPEM, jwtPublicKeyPEM } = config;
  domain = `${domain}:${port}`;
  config.domain = domain;

  // Set jwt keys if they were missing from the environment
  if( ! jwtPrivateKeyPEM && ! jwtPublicKeyPEM) {
    const { privateKeyPEM, publicKeyPEM } = new Keys();
    config.jwtPrivateKeyPEM = privateKeyPEM;
    config.jwtPublicKeyPEM = publicKeyPEM;
  }

  let axiosInstance:AxiosInstance, proxyUrl:string|undefined;

  if(domain) {
    // Assume the app host always requires https connection
    proxyUrl = `https://${domain}`;
    axiosInstance = axios.create({
      baseURL: proxyUrl,
      httpsAgent: new Agent({
        rejectUnauthorized: false,
      })
    } as AxiosRequestConfig);

    axiosInstance.defaults.maxRedirects = 0;
    axiosInstance.interceptors.response.use(
      response => response,
      error => {
        if(error.response && [301, 302].includes(error.response.status)) {
          console.log('Axios got a redirect response');
          // console.log(`${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`);
          return Promise.resolve(error.response);
        }
        if(error.response && error.response.status == 403) {
          return Promise.resolve(error.response);
        }
        return Promise.reject(error);
      }
    );
  }

  const express = require('express');

  const app = express();

  // for parsing application/x-www-form-urlencoded
  app.use(express.urlencoded({ extended: true }));

  // for parsing application/json
  app.use(express.json());

  // for parsing application/octet-stream
  app.use(express.raw());

  app.use(express.static('public'));

  const { privateKeyPEM, certificatePEM } = new Keys();
  const server = createServer({key: privateKeyPEM, cert: certificatePEM }, app) as Server;
    
  // Handle all http requests
  app.all('/*', async (req:Request, res:Response) => {
    try {
      if(/favicon/i.test(req.url)) {
        res.status(200).send('favicon');
        return;
      }
      
      if( ! appHost) {
        /**
         * We must be running as a vscode launch configuration (not docker), so countermand the APP_AUTHORIZATION
         * variable because there is no app container to proxy to for delegating the authentication decisions to.
         */
        config.appAuthorization = false;
      }

      await screenRequestForAuthentication(req, res, axiosInstance, (error:any) => {
        handleRequestByImpersonatingTargetApp(req, res, error);
      });
    } 
    catch (e:any) {
      console.log(`APP RESPONSE ERROR: ${e.stack}`);
      res.status(500).send(`${JSON.stringify({ message: e.message, stack: e.stack }, null, 2)}`);
    }    
  });
  
  console.log('STARTUP VARS:');
  console.log(JSON.stringify({ port, proxyUrl }, null, 2));

  server.listen(port, '0.0.0.0', () => console.log(`⚡️[bootup]: Server is running at port: ${port}`));


  /**
   * This function performs the "sp" (shibboleth service provider) actions where the incoming request is either
   * passed through to the target app if a valid auth token is found, else login with the IDP is initiated.
   * @param req 
   * @param res 
   * @param axiosInstance 
   * @param onProxyError 
   * @returns 
   */
  const screenRequestForAuthentication = async (req:Request, res:Response, axiosInstance:AxiosInstance, onProxyError:Function) => {

    // Transform the incoming express request object to an object of IRequest type
    const authRequest:IRequest = transformExpressRequest(req);

    // Handle the authentication
    const authResponse:IRequest|IResponse = await handler(authRequest, config);

    const spRedirect = ():boolean => `${authResponse.status}`.startsWith('30')
    const authenticated = Headers(authResponse).isTruthy('authenticated');

    if(appHost && ! spRedirect()) {
        // Proxy to the app container across the docker bridge network
      try {
        await proxypass({ appHost, authResponse, axios:axiosInstance, req, res });
      }
      catch(e) {
        onProxyError(e);
      }
      return;
    }

    if(authenticated) {
      // No separate container as app host, so just simulate one by returning a dummy response in lieu of app host.
      handleRequestByImpersonatingTargetApp(req, res, null);
      return;
    }

    // Not authenticated, so start next step of saml flow
    const { headers } = authResponse;
    if(headers) {
      for(const hdr in headers) {
        res.set(hdr, headers[hdr][0].value);
      }
    }
    const statusCodeStr = (authResponse as IResponse).status ?? `${res.statusCode}`;
    res.status(parseInt(statusCodeStr)).send(authResponse.body);
  }

  /**
   * Just impersonate an app by doing something with the http request - in this case, render the jwt it is 
   * getting now out to the response (and an error from a failed proxy attempt by the sp if provided).
   * @param req 
   * @param res 
   * @param error 
   */
  const handleRequestByImpersonatingTargetApp = (req:Request, res:Response, error:any) => {
    const jwtTools = new JwtTools();
    const { jwtPrivateKeyPEM, jwtPublicKeyPEM } = config;
    jwtTools.resetPrivateKey(jwtPrivateKeyPEM!);
    jwtTools.resetPublicKey(jwtPublicKeyPEM!);
    const authRequest:IRequest = transformExpressRequest(req);
    const token = jwtTools.getToken(authRequest);
    const { user } = token ? token[jwtTools.getTokenName()] : { user: 'unknown user' };
    const json = JSON.stringify(user, null, 2);
    const logoutUrl = `https://${req.header('host')}/logout`;
    let logout = `<button type="button" onclick="document.location.href = '${logoutUrl}';">Logout</button>`;
    let msg1 = `This is an impersonation of the application endpoint ${logout}`;
    let msg2 = 'Had you been running under docker, a separate container on the docker bridge would have served up this page';
    let msg3 = 'This is what was found in the JWT:'
    let msg4 = `<pre>${json}</pre>`
    if(error && appHost) {
      const errJson = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
      msg2 = `There was an error attempting to proxy to the docker app container: <pre>${errJson}</pre>`
    }
    console.log(`REPLYING WITH: ${json}`)  
    res.send(`
      <html><body>
        <p>${msg1}</p>
        <p>${msg2}</p>
        <p>${msg3}</p>
        <p>${msg4}</p>
      </body></html>`);
  }
}


export type ProxyPassParms = {
  appHost:string|undefined,
  req:Request,
  res:Response,
  authResponse:IResponse|IRequest,
  axios:AxiosInstance
}

/**
 * Proxy to the app container across the docker bridge network.
 * @param parms 
 */
export const proxypass = async (parms:ProxyPassParms) => {
  const { appHost, authResponse, axios, req, req: { url, method, headers, body }, res } = parms;

  // Put all original headers
  const headersOut = {} as any;
  Object.keys(headers).forEach(key => {
    headersOut[key.toLowerCase()] = req.header(key);
  });

  // Put all additional headers returned in the authentication response.
  const { headers:lrHeaders } = authResponse;
  if(headers) {
    for(const hdr in lrHeaders) {
      headersOut[lrHeaders[hdr][0].key] = lrHeaders[hdr][0].value;
    }
  }

  let response:AxiosResponse<any, any> | undefined;
  let appUrl = new URL(`https://${appHost}${url}`);

  switch(method.toLowerCase()) {
    case 'get':
      console.log(`Proxying ${url} get request to ${appUrl.href}, headers: ${JSON.stringify(headersOut, null, 2)}`);
      response = await axios.get(appUrl.href, { headers:headersOut });
      break;
    case 'post':
      const formdata = body;
      console.log(`Proxying ${url} post request to ${appUrl.href}: ${JSON.stringify({
        headers: headersOut, 
        formdata
      }, null, 2)}`);
      response = await axios.post(appUrl.href, formdata, { headers:headersOut });          
      break;
  }

  res.set(response?.headers);
  res.status(response?.status ?? 500).send(response?.data);

  console.log(`RESPONSE: ${JSON.stringify(res, Object.getOwnPropertyNames(res), 2)}}`);    
}

if(process.env.UNIT_TESTING != 'true') {
  startExpressServer(handler);
}
