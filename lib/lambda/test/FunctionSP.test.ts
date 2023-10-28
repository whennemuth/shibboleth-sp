import { jest } from '@jest/globals';
import { handler } from '../FunctionSP';
import { CachedKeys } from '../lib/Secrets';
import * as event from '../lib/sp-event.json';
import { Keys } from './Keys';

/**
 * ---------------------------------------------------------------------------
 *                       TEST HARNESS.
 * ---------------------------------------------------------------------------
 */
if(process.env?.unmocked === 'true') {
  handler(event).then((response) => {
    JSON.stringify(response, null, 2);
  })
  process.exit()
}
/**
 * ---------------------------------------------------------------------------
 *                       MOCKED UNIT TESTING.
 * ---------------------------------------------------------------------------
 */
else {
  jest.mock('../lib/Secrets', () => {
    // Mock the behavior of Secrets.ts (getting secrets from secret manager).
    const originalModule = jest.requireActual('../lib/Secrets');
    const keys = new Keys();
    return {
      __esModule: true,
      originalModule,
      checkCache: async (cache:CachedKeys): Promise<void> => {
        cache.samlCert = keys.certificate;
        cache.samlPrivateKey = keys.privateKey;
        cache.jwtPublicKey = keys.publicKey;
        cache.jwtPrivateKey = keys.privateKey;
      }
    };
  });

  describe('sp.ts event handler', () => {
    it('Should return a response', async () => {
      const retval = await handler(event);
      expect(retval).toBeDefined();
    });
  });
}

