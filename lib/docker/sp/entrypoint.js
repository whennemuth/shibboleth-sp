const express = require('express');
const multer = require('multer'); // For mulit-part form uploads
const https = require('https');
const fs = require('fs');
const port = process.env.EXPRESS_PORT;
const apphost = process.env?.APP_HOST;

/**
 * Start an instance of express listening on the designated port
 */
const startServer = (parms) => {
  const { handler, getJwtTools, getKeyLib } = parms;

  let axios, proxyUrl;
  if(apphost) {
    // Assume the app host always requires https connection
    proxyUrl = `https://${apphost}`;
    axios = require("axios").create({
      baseURL: proxyUrl,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      })
    });
  }

  const app = express();

  // for parsing application/x-www-form-urlencoded
  app.use(express.urlencoded({ extended: true }));

  // for parsing application/json
  app.use(express.json());

  // for parsing application/octet-stream
  app.use(express.raw());

  // for parsing multipart/form-data
  const upload = multer();
  app.use(upload.array()); 
  app.use(express.static('public'));

  const keys = getKeyLib();
  const server = https.createServer({key: keys.privateKeyPEM, cert: keys.certificatePEM }, app);
    
  // Handle all http requests
  app.all('/*', async (req, res) => {
    try {
      const event = buildEvent(req);
      const lambdaResponse = await handler(event);

      await handleRequestAsLambdaEdgeFunction(req, res, lambdaResponse, axios, (error) => {
        handleRequestAsTargetApp(req, res, getJwtTools, error);
      });
    } 
    catch (e) {
      console.log(`APP RESPONSE ERROR: ${e.stack}`);
      res.status(500).send({ message: e });
    }    
  });
  
  console.log('STARTUP VARS:');
  console.log(JSON.stringify({ port, proxyUrl }, null, 2));

  server.listen(port, '0.0.0.0', () => console.log(`⚡️[bootup]: Server is running at port: ${port}`));
}

/**
 * This is the "sp" (shibboleth service provider) container that simulates lambda@edge. 
 * Handle authentication, caching, tokens, and/or pass through request to the "app" container.
 * @param {*} req Express request
 * @param {*} res Express response
 * @param {*} lambdaResponse The output of the handler function
 * @returns 
 */
const handleRequestAsLambdaEdgeFunction = async (req, res, lambdaResponse, axios, onProxyError) => {
  const authenticated = lambdaResponse.headers.authenticated === 'true';

  if(authenticated && apphost) {
    // Proxy to the app container across the docker bridge network
    try {
      await proxypass(req, res, axios);
    }
    catch(e) {
      onProxyError(e);
    }
    return;
  }

  if(authenticated) {
    // No separate container as app host, so just simulate one by returning a dummy response in lieu of app host.
    const json = JSON.stringify(event, null, 2);
    res.send(`<html><body><pre>${json}</pre></body></html>`);
    return;
  }

  // Not authenticated, so start next step of saml flow
  const { headers } = lambdaResponse;
  if(headers) {
    for(const hdr in headers) {
      res.set(hdr, headers[hdr][0].value);
    }
  }
  res.status(lambdaResponse.status).send(lambdaResponse.body);
}

/**
 * This is the "app" container. 
 * Just impersonate an app by doing something with the http request - in this case, render the jwt it is 
 * getting now out to the response (and an error from a failed proxy attempt by the sp if provided).
 * @param {*} req 
 * @param {*} res 
 */
const handleRequestAsTargetApp = (req, res, getJwtTools, error) => {
  const jwtTools = getJwtTools();
  const token = jwtTools.getToken(req);
  const { user } = token ? token[jwtTools.getTokenName()] : {};
  const json = JSON.stringify(user, null, 2);
  let msg1 = 'This is an impersonation of the application endpoint';
  let msg2 = 'Had you been running under docker, a separate container on the docker bridge would have served up this page';
  let msg3 = 'This is what was found in the JWT:'
  let msg4 = `<pre>${json}</pre>`
  if(error && isRunningInDocker()) {
    errJson = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
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

/**
 * Build a lambda event object out of the incoming request.
 * @param {*} req 
 * @returns An object is as would be expected by a lambda@edge viewer request function.
 */
const buildEvent = (req) => {
  let { url, method, headers:headersIn, body:rawBody } = req;

  // Reform headers
  const headersOut = {};
  Object.keys(headersIn).forEach(key => {
    headersOut[key.toLowerCase()] = [{
      key, value: req.header(key)
    }]    
  });

  // Get the uri and querystring
  const parts = url.split('?');
  const uri = parts[0];
  const querystring = parts.length > 1 ? parts[1] : '';

  // Reform the body
  let body = {};
  rawBody = rawBody || {};
  if(Object.keys(rawBody).length > 0) {
    const bodyString = Object.keys(rawBody).map(key => `${key}=${encodeURIComponent(rawBody[key])}`).join('&');
    body = {
      data: Buffer.from(bodyString, 'utf8').toString('base64')
    }
  }

  const event = {
    Records: [{
      cf: {
        config: {
          distributionDomainName: `localhost:${port}`
        },
        request: {
          body, headers: headersOut, method, querystring, uri           
        }
      }
    }]
  };

  return event;
}

/**
 * Proxy to the app container across the docker bridge network.
 * @param {*} req 
 * @param {*} lambdaResponse 
 */
const proxypass = async (req, res, axios) => {
  
  const { url, method, headers, body } = req;

  // Put all headers
  const headersOut = {};
  Object.keys(headers).forEach(key => {
    headersOut[key.toLowerCase()] = req.header(key);
  });

  let response;
  let appUrl = new URL(`https://${apphost}${url}`);
  switch(method.toLowerCase()) {
    case 'get':
      console.log(`Proxying ${url} get request to ${appUrl.href}, headers: ${JSON.stringify(headersOut, null, 2)}`);
      response = await axios.get(appUrl.href, { headers:headersOut });
      break;
    case 'post':
      const formdata = req.body;
      console.log(`Proxying ${url} post request to ${appUrl.href}: ${JSON.stringify({
        headers: headersOut, 
        formdata
      }, null, 2)}`);
      response = await axios.post(appUrl.href, formdata, { headers:headersOut });          
      break;
  }

  res.set(response.headers);
  res.status(200).send(response.data);
}

const isRunningInDocker = () => {
  try {
    // Read the contents of the cgroup file for the init process
    const cgroupContent = fs.readFileSync('/proc/1/cgroup', 'utf8');
    
    // Check if the content contains the Docker cgroup identifier
    return cgroupContent.includes('docker');
  } catch (error) {
    // Error occurred while reading the file, handle accordingly
    console.error('Error reading cgroup file:', error);
    return false;
  }
}

module.exports = { startServer, buildEvent, proxypass };