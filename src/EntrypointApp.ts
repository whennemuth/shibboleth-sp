import { Request, Response } from 'express';
import { createServer } from 'https';
import { IConfig, getConfigFromEnvironment } from './Config';
import { handler } from './HandlerApp';
import { AUTH_PATHS } from './HandlerSp';
import { IRequest, IResponse, addHeader } from './Http';
import { Keys } from './Keys';
import { transformExpressRequest } from './Utils';


// Get configuration values from the environment as a consolidated object
const config:IConfig = getConfigFromEnvironment();

/**
 * Start an instance of express listening on the designated port
 * 
 * NOTE: does not process multipart/form-data. 
 * For this use: https://expressjs.com/en/resources/middleware/multer.html
 */
export const startExpressServer = () => {

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
  const server = createServer({key: privateKeyPEM, cert: certificatePEM }, app);
    
  // Handle all http requests
  app.all('/*', async (req:Request, res:Response) => {
    try {
      console.log(`Incoming request: ${JSON.stringify(req, Object.getOwnPropertyNames(req), 2)}`);     
      const request = buildRequest(req);
      console.log(`Generated request: ${JSON.stringify(request, null, 2)}`);

      const response = await handler(request, config) as IResponse;

      const { headers } = response;

      // Restore/add the headers to the express request object from the handler response obj.
      if(headers) {
        for(const hdr in headers) {
          const { key, value } = headers[hdr][0];
          res.set(key, value);
        }
      }

      // Apply the status of the handler response obj to the original express response obj.
      res.status(parseInt(response.status));

      // Normally an sp handler would intercept requests to the login endpoint, but account for running as test-harness.
      if(req.path == AUTH_PATHS.LOGIN) {
        response.body = '<!DOCTYPE html><html><body><h3>This is the IDP login page</h3></body></html>';
      }

      // Send the response.
      res.send(response.body);
      console.log(`App response: ${JSON.stringify(response, null, 2)}`);     
    }
    catch(e:any) {
      res.status(500).contentType('text/html').send(`
      <!DOCTYPE html>
      <html>
        <body>
          <p><b>${e.message}</b></p>
          <pre>${e.stack}</pre>
        </body>
      </html>      
    `);
    }
  });

  server.listen(443, '0.0.0.0', () => console.log(`⚡️[bootup]: Server is running at port: ${443}`));
}

/**
 * Convert express.Request to IRequest and add the login and logout headers.
 * @param {*} req A complete express request object
 * @returns An object implementing the simpler IRequest interface.
 */
export const buildRequest = (req:Request): IRequest => {
  const { url, protocol } = req;
  const request = transformExpressRequest(req);
  const relayDomain = `${protocol}://${req.header('host')}`;
  const relayState = encodeURIComponent(`${relayDomain}${url}`);
  const loginUrl = `${relayDomain}${AUTH_PATHS.LOGIN}?relay_state=${relayState}`;
  const logoutUrl = `${relayDomain}${AUTH_PATHS.LOGOUT}`;
  const { appLoginHeader, appLogoutHeader } = config;
  const { APP_APPEND_AUTH_HEADERS='true' } = process.env;

  if(APP_APPEND_AUTH_HEADERS === 'true') {
    addHeader(request, appLoginHeader, encodeURIComponent(loginUrl));
    addHeader(request, appLogoutHeader, encodeURIComponent(logoutUrl));
  }

  return request;
}

startExpressServer();