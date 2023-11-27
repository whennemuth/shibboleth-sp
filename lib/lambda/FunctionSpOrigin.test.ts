import { jest } from '@jest/globals';
import { handler } from './FunctionSpOrigin';
import { CachedKeys } from './lib/Secrets';
import * as event from './lib/sp-event.json';
import { Keys } from './lib/test/Keys';

/**
 * ---------------------------------------------------------------------------
 *                       TEST HARNESS.
 * ---------------------------------------------------------------------------
 */
if(process.env?.unmocked === 'true') {
  handler(event).then((response) => {
    JSON.stringify(response, null, 2);
  })
}
/**
 * ---------------------------------------------------------------------------
 *                       MOCKED UNIT TESTING.
 * ---------------------------------------------------------------------------
 */
else {
  jest.mock('./lib/Secrets', () => {
    // Mock the behavior of Secrets.ts (getting secrets from secret manager).
    const originalModule = jest.requireActual('./lib/Secrets');
    const keys = new Keys();
    return {
      __esModule: true,
      originalModule,
      checkCache: async (cache:CachedKeys): Promise<void> => {
        cache.samlCert = keys.certificatePEM;
        cache.samlPrivateKey = keys.privateKeyPEM;
        cache.jwtPublicKey = keys.publicKeyPEM;
        cache.jwtPrivateKey = keys.privateKeyPEM;
      }
    };
  });

/**
 * RESUME NEXT: Complete these tests:
 */
  describe('sp.ts event handler', () => {
  // Figure out how to mock saml2-js.IdentityProvider. Try both successful auth and rejected auth. 
    it('Should redirect back to original request if has SAMLResponse querystring parameter \
        and should set cookie in response.');

    it('Should redirect to the IDP (loginUrl) if no SAMLResponse querystring parameter')

    it('Should do nothing in the event of a valid token');
  });
}