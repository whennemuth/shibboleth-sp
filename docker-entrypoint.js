const express = require('express');
const multer = require('multer'); // For mulit-part form uploads
const { handler, getJwtTools, getKeyLib } = require('./sp');
const https = require('https');
const port = process.env.EXPRESS_PORT;
const targetAppMode = process.env?.AUTHENTICATE == 'false';

const apphost = process.env?.APP_HOST;
let proxyUrl, axios;
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

/**
 * Start an instance of express listening on the designated port
 */
const startServer = () => {
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
      if(targetAppMode) {
        handleRequestAsTargetApp(req, res);
      }
      else {
        await handleRequestAsLambdaEdgeFunction(req, res);
      }
      return;
    } 
    catch (e) {
      console.log(`APP RESPONSE ERROR: ${e.stack}`);
      res.status(500).send({ message: e });
    }    
  });
  
  console.log('STARTUP VARS:');
  console.log(JSON.stringify({ port, proxyUrl, targetAppMode }, null, 2));

  server.listen(port, '0.0.0.0', () => console.log(`⚡️[bootup]: Server is running at port: ${port}`));
}

/**
 * This is the "sp" (shibboleth service provider) container that simulates lambda@edge. 
 * Handle authentication, caching, tokens, and/or pass through request to the "app" container.
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
const handleRequestAsLambdaEdgeFunction = async (req, res) => {
  const event = buildEvent(req);

  const lambdaResponse = await handler(event);
  const authenticated = lambdaResponse.headers.authenticated === 'true';

  if(authenticated && apphost) {
    // Proxy to the app container across the docker bridge network
    await proxypass(req, res);
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
 * getting now out to the response.
 * @param {*} req 
 * @param {*} res 
 */
const handleRequestAsTargetApp = (req, res) => {
  const jwtTools = getJwtTools();
  const token = jwtTools.getToken(req);
  const { user } = token ? token[jwtTools.getTokenName()] : {};
  const json = JSON.stringify(user, null, 2);
  console.log(`REPLYING WITH: ${json}`)  
  res.send(`<html><body><p>HELLO FROM THE APP</p><p>This is what I found in the JWT:</p><pre>${json}</pre></body></html>`);
}

/**
 * Build a lambda event object out of the incoming request.
 * @param {*} req 
 * @returns An object is as would be expected by a lambda@edge viewer request function.
 */
const buildEvent = (req) => {
  const { url, method, headers:headersIn, body:rawBody } = req;

  // Reform headers
  const headersOut = {};
  Object.keys(headersIn).forEach(key => {
    headersOut[key.toLowerCase()] = [{
      key, value: req.header(key)
    }]    
  });

  // Get the uri and querystring
  const parts = url.split('?');
  const uri = parts[0]; // TODO: Figure out if uri actually includes the querystring or not.
  const querystring = parts.length > 1 ? parts[1] : '';

  // Reform the body
  let body = {};
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
const proxypass = async (req, res) => {
  try {
    const { url, method, headers, body } = req;

    // Put all headers
    const headersOut = {};
    Object.keys(headers).forEach(key => {
      headersOut[key.toLowerCase()] = req.header(key);
    });
  
    let response;
    switch(method.toLowerCase()) {
      case 'get':
        console.log(`Proxying get request to ${url}, headers: ${JSON.stringify(headersOut, null, 2)}`);
        response = await axios.get(url, { headers:headersOut });
        break;
      case 'post':
        const formdata = req.body;
        console.log(`Proxying post request to ${url}: ${JSON.stringify({
          headers: headersOut, 
          formdata
        }, null, 2)}`);
        response = await axios.post(url, formdata, { headers:headersOut });          
        break;
    }

    res.set(response.headers);
    res.status(200).send(response.data);
  }
  catch (e) {
    res.status(500).send(`<html><body><p>Server Error:</p><pre>${e.stack}</pre></body></html>`);
  }
}

startServer();