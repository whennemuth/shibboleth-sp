const express = require('express');
const multer = require('multer'); // For mulit-part form uploads
const https = require('https');
const { handler, Keys } = require('./app');

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

  const keys = new Keys();
  const server = https.createServer({key: keys.privateKeyPEM, cert: keys.certificatePEM }, app);
    
  // Handle all http requests
  app.all('/*', async (req, res) => {
    try {
      const event = buildEvent(req);
      const lambdaResponse = await handler(event);
      res.send(lambdaResponse);
    }
    catch(e) {
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

const buildEvent = (req) => {

  return {
    rawPath: req.url,
    rawQueryString: req._parsedUrl?.query,
    cookies: [
      req.header('Cookie')
    ],
    headers: {
      'user-details': req.header('user-details'),
      'cookie': req.header('Cookie'),
      'host': req.header('host')
    }
  }
}

startServer();