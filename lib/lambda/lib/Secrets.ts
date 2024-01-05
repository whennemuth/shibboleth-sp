import { GetSecretValueCommand, GetSecretValueCommandOutput, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import * as context from '../../../context/context.json';
import { Secret } from '../../../context/IContext';
import { Keys } from './Keys';

const { _secretArn, _refreshInterval, samlCertSecretFld, samlPrivateKeySecretFld, jwtPublicKeySecretFld, jwtPrivateKeySecretFld } = context.SHIBBOLETH.secret as Secret;
const refreshInterval = parseInt(_refreshInterval)

export type CachedKeys = {
  _timestamp: number;
  samlCert: string;
  samlPrivateKey: string;
  jwtPrivateKey: string;
  jwtPublicKey: string;
}

export type SecretsConfig = {
  _secretArn:string;
  _refreshInterval:string;
  samlCertSecretFld:string;
  samlPrivateKeySecretFld:string;
  jwtPublicKeySecretFld:string;
  jwtPrivateKeySecretFld:string
}

/**
 * The cache is refreshable if any of the keys in it are empty, or the timestamp indicates it's time to refresh.
 * @param cache 
 * @returns 
 */
export const refreshable = (cache:CachedKeys, refreshInterval:number, now:number) => {

  if(process?.env.AUTHENTICATE === 'false') {
    // No need to use the cache since there is no authentication to come.
    return false;
  }

  const { _timestamp, jwtPrivateKey, jwtPublicKey, samlCert, samlPrivateKey } = cache;

  const cacheIsEmptyOrInvalid = () => {
    return samlCert.length === 0 ||
    samlPrivateKey.length === 0 ||
    jwtPublicKey.length === 0 ||
    jwtPrivateKey.length === 0;
  }
    
  const envSamlFound = () => {
    return process?.env?.SAML_PK && process?.env?.SAML_CERT
  }

  if(cacheIsEmptyOrInvalid() && envSamlFound()) {
    loadFromScratch(cache);
    return false;
  }
  if(cacheIsEmptyOrInvalid() || now - _timestamp > refreshInterval) {
    return true;
  }
  return false;
}

/**
 * Lambda@edge does not support environment variables, so if any are found (like SAML_PK), this means that the
 * app is being run locally, ie: in a docker container, so the keys can be created from scratch and set in the cache.
 * @param cache 
 */
const loadFromScratch = (cache:CachedKeys) => {
  console.log('Cache: Building keys from scratch...');
  const jwtKeys = new Keys();
  cache.jwtPrivateKey = jwtKeys.privateKeyPEM;
  cache.jwtPublicKey = jwtKeys.publicKeyPEM;
  cache.samlPrivateKey = process.env.SAML_PK || '';
  cache.samlCert = process.env.SAML_CERT || '';
}

/**
* Obtain the shibboleth & jwt certs/keys from secrets manager and populate the supplied cache object with them.
* @returns 
*/
export async function checkCache(cache:CachedKeys, config?:SecretsConfig): Promise<void> {
  // If a cache configuration is not supplied, get it from the context instead.
  const _config = config || {
    refreshInterval, _secretArn, jwtPrivateKeySecretFld, jwtPublicKeySecretFld, samlCertSecretFld, samlPrivateKeySecretFld
  };
  
  const now = Date.now();
  if (refreshable(cache, refreshInterval, now)) {
    try {
      const { _secretArn, samlCertSecretFld, samlPrivateKeySecretFld, jwtPrivateKeySecretFld, jwtPublicKeySecretFld } = _config;
      const command = new GetSecretValueCommand({ SecretId: _secretArn });
      const region = _secretArn.split(':')[3];
      const secretsClient = new SecretsManagerClient({ region });
      const response:GetSecretValueCommandOutput = await secretsClient.send(command);
      if( ! response.SecretString) {
        throw new Error('Empty/missing cert!');
      }
      const fieldset = JSON.parse(response.SecretString);
      cache.samlCert = fieldset[samlCertSecretFld];
      cache.samlPrivateKey = fieldset[samlPrivateKeySecretFld];
      cache.jwtPublicKey = fieldset[jwtPublicKeySecretFld];
      cache.jwtPrivateKey = fieldset[jwtPrivateKeySecretFld];
      cache._timestamp = now;
      console.log(`Retrieved shib cert from secrets manager in ${Date.now() - now} milliseconds`);
    } catch (e) {
      console.error(`Cannot get cert from secrets manager, error: ${e}`);
    }
  }
  else {
    console.log('Using cache: certs & keys found in cache and before their stale date');
  }
}

export const getKeys = ():any => {
  return new Keys();
}
