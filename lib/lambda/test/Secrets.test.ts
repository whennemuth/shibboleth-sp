import { mockClient } from 'aws-sdk-client-mock'
import 'aws-sdk-client-mock-jest';
import { SecretsConfig, CachedKeys, checkCache } from '../lib/Secrets';
import { Keys } from './Keys';
import { GetSecretValueCommand, GetSecretValueCommandOutput, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

/**
 * ---------------------------------------------------------------------------
 *                       TEST HARNESS.
 * ---------------------------------------------------------------------------
 */
if(process.env?.unmocked === 'true') {
  // Starting with an empty cache, which kick off the refresh process.
  describe('Getting secret keys', () => {
    it('Should run without unit tests', async () => {
      const cache = {
        _timestamp: 0,
        samlCert: '',
        samlPrivateKey: '',
        jwtPrivateKey: '',
        jwtPublicKey: ''
      };
      await checkCache(cache);
      expect(cache.samlCert.length).toBeGreaterThan(1);
      console.log(JSON.stringify(cache, null, 2));
    });
  });
}
/**
 * ---------------------------------------------------------------------------
 *                       MOCKED UNIT TESTING.
 * ---------------------------------------------------------------------------
 */
else {
  const keys = new Keys();
  const smMockClient = mockClient(SecretsManagerClient);

  // Create a mock of the client that talks to secrets manager. Have it return some dynamically created keys.
  smMockClient.on(GetSecretValueCommand).resolves({
    SecretString: JSON.stringify({
      'jpkfld': keys.privateKey,
      'jpufld': keys.publicKey,
      'spkfld': keys.certificate,
      'sctfld': keys.privateKey
    }, null, 2)
  } as GetSecretValueCommandOutput)

  // Get a new instance of a cache configuration
  const getConfig = ():SecretsConfig => {
    const minute = '60000';
    return {
      _secretArn: '',
      _refreshInterval: '',
      samlCertSecretFld: 'sctfld',
      samlPrivateKeySecretFld: 'spkfld',
      jwtPublicKeySecretFld: 'jpufld',
      jwtPrivateKeySecretFld: 'jpkfld'
    }
  }

  // Get a new instance of a cache
  const getCache = ():CachedKeys => {
    return {
      _timestamp: 0,
      samlCert: 'dummy_value',
      samlPrivateKey: 'dummy_value',
      jwtPrivateKey: 'dummy_value',
      jwtPublicKey: 'dummy_value'
    };
  }

  // Assert that an attempt to refresh the cache was made.
  const assertRefreshHappenedTo = (cache:CachedKeys) => {
    expect(smMockClient).toHaveReceivedCommandTimes(GetSecretValueCommand, 1);
    expect(cache.jwtPrivateKey).toBeTruthy();
    expect(cache.jwtPublicKey).toBeTruthy();
    expect(cache.samlCert).toBeTruthy();
    expect(cache.samlPrivateKey).toBeTruthy();
    smMockClient.resetHistory();
  }

  describe('Secrets', () => {

    let cache;
    let config;

    it('Should populate keys if any one of them are empty', async() => {
      cache = getCache();
      config = getConfig();
      const hour = 1000 * 60 * 60
      const oneHourAgo = Date.now() - hour;
      // Blank out just one of the keys
      cache.samlCert = '';
      // Indicate refresh interval has NOT elapsed
      cache._timestamp = oneHourAgo;
      config._refreshInterval = (hour * 2)+''
      // Check the cache and assert that this resulted in a refresh
      await checkCache(cache, config);
      assertRefreshHappenedTo(cache);
    });

    it('Should populate keys if none are empty, but timestamp indicates interval has elapsed.', async() => {
      cache = getCache();
      config = getConfig();
      const hour = 1000 * 60 * 60
      const twoHoursAgo = Date.now() - ( hour * 2 );
      // Indicate refresh interval HAS elapsed
      cache._timestamp = twoHoursAgo;
      config._refreshInterval = hour+'';
      await checkCache(cache, config);
      assertRefreshHappenedTo(cache);   
    });

    it('Should NOT populate keys if none are empty and timestamp indicates interval has NOT elapsed.', async() => {
      cache = getCache();
      config = getConfig();
      const hour = 1000 * 60 * 60
      const oneHourAgo = Date.now() - hour;
      // Leave all keys populated
      // Indicate refresh interval has NOT elapsed
      cache._timestamp = oneHourAgo;
      config._refreshInterval = (hour * 2)+''
      // Check the cache and assert that this DID NOT result in a refresh
      await checkCache(cache, config);
      expect(smMockClient).toHaveReceivedCommandTimes(GetSecretValueCommand, 0);
    })
  });
}




