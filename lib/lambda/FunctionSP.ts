import { CachedKeys, checkCache } from './lib/Secrets';
import { SAMLAssertResponse } from 'saml2-js';
import { SamlTools } from './lib/Saml';
import { JwtTools } from './lib/Jwt';

const jwtTools = new JwtTools();
const samlTools = new SamlTools();

const cachedKeys:CachedKeys = { 
  _timestamp: 0, /* One hour */ 
  samlCert: '', samlPrivateKey: '', jwtPrivateKey: '', jwtPublicKey: '',
};

// Perform cold-start loading of global cache by fetching saml cert and private key.
checkCache(cachedKeys).then(() => {
  const { samlPrivateKey, samlCert, jwtPrivateKey, jwtPublicKey } = cachedKeys;
  samlTools.resetCertificate(samlCert);
  samlTools.resetPrivateKey(samlPrivateKey);
  jwtTools.resetKeyPair(jwtPrivateKey);
  jwtTools.resetPublicKey(jwtPublicKey);
});


export const handler =  async (event:any) => {
  const request = event.Records[0].cf.request;
  await checkCache(cachedKeys);

  try {
    const requestUrl = new URL(`https://${request.headers.host[0].value}${request.uri}`);
    
    if (jwtTools.hasValidToken(request)) {
      // Tokens are valid, consider the user authenticated and pass through to the origin.
      console.log('Authenticated user');
      return request;
    } 
    else if (requestUrl.searchParams.has('SAMLResponse')) {
      // Login is complete, so assert endpoint.
      const samlResponse:SAMLAssertResponse = await samlTools.redirectAssert(requestUrl);
      const message = `Authentication successful. User: ${samlResponse.user.name_id}`
      const cfResponse = {
        status: '200',
        statusDescription: 'OK',
        body: message,
        headers: {
          'content-type': [{ key: 'Content-Type', value: 'text/plain' }],
        },
      };

      jwtTools.setCookieInResponse(cfResponse, {
        sub: samlResponse.user.name_id, 
        email: samlResponse.user.email
      });
      
      // Authentication successful, continue with your logic
      console.log(message);
      return cfResponse;
    }
    else {
      // User is not authenticated, initiate SAML authentication
      const loginUrl = await samlTools.createLoginRequestUrl(requestUrl.pathname);
      return {
        status: '302',
        statusDescription: 'Found',
        headers: {
          location: [{ key: 'Location', value: loginUrl }],
        },
      };
    }
  } catch (error) {
    // Handle authentication error
    console.error('Authentication error:', error);
    return {
      status: '401',
      statusDescription: 'Unauthorized',
      body: 'Authentication failed.',
      headers: {
        'content-type': [{ key: 'Content-Type', value: 'text/plain' }],
        'www-authenticate': [{ key: 'WWW-Authenticate', value: 'Basic' }],
      },
    };
  }
};





