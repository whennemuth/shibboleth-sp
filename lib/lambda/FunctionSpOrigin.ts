import { CachedKeys, checkCache } from './lib/Secrets';
import { SamlTools, SamlToolsParms, SendAssertResult } from './lib/Saml';
import { JwtTools } from './lib/Jwt';
import * as contextJSON from '../../context/context.json';

const jwtTools = new JwtTools();
const context = contextJSON;
const debug = process.env?.DEBUG == 'true';
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

const debugPrint = (value:string) => {
  if(debug) {
    console.log(`DEBUG: ${value}`);
  }
}

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
  const cloudfrontDomain = event.Records[0].cf.config.distributionDomainName;
  const rootUrl = `https://${cloudfrontDomain}`;
  samlTools.setAssertUrl(`${rootUrl}/assert`);

  debugPrint(JSON.stringify(event, null, 2));

  try {
    let response;
    const { uri='/', querystring } = originRequest;
    const qsparms = querystring ? new URLSearchParams(querystring) : null;
    console.log(`uri: ${uri}`);
    console.log(`querystring: ${querystring}`);
    
    switch(uri) {
      case '/login':
        console.log('User is not authenticated, initiate SAML authentication...');
        var relayState:string|null = decodeURIComponent(qsparms ? qsparms.get('relay_state') || '' : rootUrl);
        const loginUrl = await samlTools.createLoginRequestUrl(relayState);
        response = {
          status: '302',
          statusDescription: 'Found',
          headers: {
            location: [{ key: 'Location', value: loginUrl }],
          },
        };
        debugPrint(`response: ${JSON.stringify(response, null, 2)}`);
        break;

      case '/logout':
        const target = qsparms ? qsparms.get('target') : null;
        if(target == 'idp') {
          // Second step: logout with the Idp
          const logoutUrl = await samlTools.createLogoutRequestUrl();
          response = {
            status: '302',
            statusDescription: 'Found',
            headers: {
              location: [{ key: 'Location', value: logoutUrl }],
            },
          };
          debugPrint(`IDP logout response: ${JSON.stringify(response, null, 2)}`);  
        }
        else {
          // First step: invalidate the jwt along with a redirect to come back and logout with the IDP
          response = {
            status: '302',
            statusDescription: 'Found',
            headers: {
              location: [{ key: 'Location', value: `${rootUrl}/logout?target=idp` }],
            }
          }
          jwtTools.setCookieInvalidationInResponse(response);
          debugPrint(`Local logout response: ${JSON.stringify(response, null, 2)}`);  
        }
        break;

      case '/assert':
        const result:SendAssertResult|null = await samlTools.sendAssert(originRequest);
        const message = `Authentication successful. result: ${JSON.stringify(result, null, 2)}`
        var { samlAssertResponse, relayState } = result;
        relayState = decodeURIComponent(relayState || rootUrl);
        if( ! samlAssertResponse) break;
                
        debugPrint(message);

        console.log(`relayState: ${relayState}`);
        const redirectUrl = new URL(relayState);
        redirectUrl.searchParams.append('after_auth', 'true');

        response = {
          status: '302',
          statusDescription: 'Found',
          headers: {
            location: [{ key: 'Location', value: redirectUrl.toString() }],
          },
        };
        const cookieValue = {
          sub: samlAssertResponse.user.name_id, 
          user: samlAssertResponse.user.attributes
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

      case '/favicon.ico':
        // This path just dirties up logs, so intercept it here and return a blank.
        // Can't seem to get an actual favicon.ico to work from here anyway.
        response = {
          status: 200,
          statusDescription: 'OK',
        }    
        break;

      default:
        const afterAuth = decodeURIComponent(qsparms ? qsparms.get('after_auth') || '' : '');
        const validToken = jwtTools.hasValidToken(originRequest);
        if (validToken) {
          // Tokens are valid, so consider the user authenticated and pass through to the origin.
          console.log('Request has valid JWT');
          response = originRequest;
          response.headers.authenticated = 'true';

          // Send the entire token in a single header
          response.headers['user-details'] = [{
            key: "User-Details",
            value: `${Buffer.from(JSON.stringify(validToken, null, 2)).toString('base64')}`
          }];

          // Also send the individual claims in separate headers, as mod_shib would.
          const { user: { eduPersonPrincipalName, buPrincipal, eduPersonAffiliation, eduPersonEntitlement } } = validToken[JwtTools.TOKEN_NAME];

          response.headers['eduPersonPrincipalName'] = [{
            key: 'eduPersonPrincipalName',
            value: eduPersonPrincipalName
          }];
          response.headers['buPrincipal'] = [{
            key: 'buPrincipal',
            value: buPrincipal
          }];
          response.headers['eduPersonAffiliation'] = [{
            key: 'eduPersonAffiliation',
            value: eduPersonAffiliation.join(';')
          }];
          response.headers['eduPersonEntitlement'] = [{
            key: 'eduPersonEntitlement',
            value: eduPersonEntitlement.join(';')
          }];

          response.headers['root-url'] = [{
            key: 'Root-URL',
            value: encodeURIComponent(rootUrl)
          }];

          response.status = 200;

          console.log(`Valid JWT found - passing through to origin: ${JSON.stringify(response, null, 2)}`);
        } 
        else if(afterAuth.toLocaleLowerCase() === 'true') {
            // The saml exchange has just taken place, and the user has authenticated with the IDP, yet either
            // the JWT did not make it into a cookie, or the cookie value did not make it into the header of 
            // this request. In either case, we don't redirect back to the login path to try again, because this
            // will most likely result in an endless loop. Just terminate with an error.
            response = {
              status: '500',
              statusDescription: 'State Error',
              body: 'Authentication should have resulted in a valid JWT - no valid token found',
              headers: {
                'content-type': [{ key: 'Content-Type', value: 'text/plain' }],
              }
            }
            console.log(`No valid JWT found after authentication: ${JSON.stringify(response, null, 2)}`); 
          }
          else {
            // No valid token has been found, and this is not a post authentication redirect - send user to login.
            const relay_state = encodeURIComponent(rootUrl + uri + (querystring ? `?${querystring}` : ''));
            const location = `${rootUrl}/login?relay_state=${relay_state}`;
            response = {
              status: '302',
              statusDescription: 'Found',
              headers: {
                location: [{ key: 'Location', value: location }],
              },
            };
            console.log(`No valid JWT found - redirecting: ${JSON.stringify(response, null, 2)}`); 
          }
        break;
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





