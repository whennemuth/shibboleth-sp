import { CachedKeys, checkCache } from './lib/Secrets';
import { SAMLAssertResponse } from 'saml2-js';
import { SamlTools, SamlToolsParms } from './lib/Saml';
import { JwtTools } from './lib/Jwt';
import * as contextJSON from '../../context/context.json';

const jwtTools = new JwtTools();
const context = contextJSON;
const { entityId, entryPoint, logoutUrl, idpCert } = context.SHIBBOLETH;
let samlTools = new SamlTools({ entityId, entryPoint, logoutUrl, idpCert } as SamlToolsParms);

const cachedKeys:CachedKeys = { 
  _timestamp: 0, /* One hour */ 
  samlCert: '', samlPrivateKey: '', jwtPrivateKey: '', jwtPublicKey: '',
};

// Perform cold-start loading of global cache by fetching saml cert and private key.
checkCache(cachedKeys).then(() => {
  const { samlPrivateKey, samlCert, jwtPrivateKey, jwtPublicKey } = cachedKeys;
  samlTools.setSpCertificate(samlCert);
  samlTools.setPrivateKey(samlPrivateKey);
  jwtTools.resetPrivateKey(jwtPrivateKey);
  jwtTools.resetPublicKey(jwtPublicKey);
});

/**
 * This is the lambda@edge function for origin request traffic. It will perform all saml SP operations for ensuring
 * that the user bears JWT proof of saml authentication, else it drives the authentication flow with the IDP.
 * 
 * NOTE: It would have been preferable to have designated this function for viewer requests so that it could 
 * intercept EVERY request instead of potentially being bypassed in favor of cached content. However, the content
 * of this function exceeds the 1MB limit for viewer requests. Origin request lambdas can be up to 50MB, and so
 * must be used, and caching for the origin is disabled altogether to ensure EVERY request goes through this function.
 * @param event 
 * @returns 
 */
export const handler =  async (event:any) => {

  await checkCache(cachedKeys);

  const originRequest = event.Records[0].cf.request;
  const domain = event.Records[0].cf.config.distributionDomainName;
  samlTools.setAssertUrl(`https://${domain}/assert`);

  try {
    let response;
    const { uri='/' } = originRequest;
    const viewerRequestUrl = new URL(`https://${domain}${uri}`);
    
    switch(uri) {
      case '/login':
        console.log('User is not authenticated, initiate SAML authentication...');
        const loginUrl = await samlTools.createLoginRequestUrl(viewerRequestUrl.pathname);
        response = {
          status: '302',
          statusDescription: 'Found',
          headers: {
            location: [{ key: 'Location', value: loginUrl }],
          },
        };
        console.log(`response: ${JSON.stringify(response, null, 2)}`);
        break;

      case '/logout':
        break;

      case '/assert':
        console.log(JSON.stringify(event, null, 2));
        const samlAssertResponse:SAMLAssertResponse|null = await samlTools.sendAssert(originRequest);
        if( ! samlAssertResponse) break;
        const message = `Authentication successful. response: ${JSON.stringify(samlAssertResponse, null, 2)}`
        console.log(message);
        response = {
          status: '200',
          statusDescription: 'OK',
          body: message,
          headers: {
            'content-type': [{ key: 'Content-Type', value: 'text/plain' }],
          },
        };
        const cookieValue = {
          sub: samlAssertResponse.user.name_id, 
          email: samlAssertResponse.user.email
        };
        console.log(`Setting JWT: ${JSON.stringify(cookieValue, null, 2)}`);
        jwtTools.setCookieInResponse(response, cookieValue);
        
        break;

      case '/metadata':
        response = {
          status: 200,
          statusDescription: 'OK',
          body: samlTools.getMetaData(),
          headers: {
            'content-type': [{ key: 'Content-Type', value: 'application/xml' }],
          },
        }
        break;

      case 'favicon.ico':
        response = {
          status: 200,
          statusDescription: 'OK',
          // body: Maybe put something in there for the ico
        }
        break;

      default:
        if (jwtTools.hasValidToken(originRequest)) {
          // Tokens are valid, so consider the user authenticated and pass through to the origin.
          console.log('Request has valid JWT');
          response = originRequest;
        } 
        else {
          response = {
            status: '302',
            statusDescription: 'Found',
            headers: {
              location: [{ key: 'Location', value: `https://${domain}/login` }],
            },
          };
        }
    }

    return response;
  } 
  catch (error:any) {
    // Handle authentication error
    console.error('Lambda error:', error);
    return {
      status: '500',
      statusDescription: 'Server Error',
      body: `${JSON.stringify({ message: error.message, stack: error.stack }, null, 2)}`,
      headers: {
        'content-type': [{ key: 'Content-Type', value: 'text/plain' }],
        // 'www-authenticate': [{ key: 'WWW-Authenticate', value: 'Basic' }],
      },
    };
  }
};





