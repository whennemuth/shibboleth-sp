import * as forge from 'node-forge';

export class Keys {
  private _keys;
  private _certificate;

  constructor() {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    const yearsToExpire = 5;
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + yearsToExpire);
  
    const attrs = [
      { name: 'commonName', value: 'example.org' },
      { name: 'countryName', value: 'US' },
      { shortName: 'ST', value: 'Massachusetts' },
      { name: 'localityName', value: 'Boston' },
      { name: 'organizationName', value: 'Boston University' },
      { shortName: 'OU', value: 'Test' }
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey);

    this._keys = keys;
    this._certificate = cert;
  }

  public get privateKey(): string{
    return forge.pki.privateKeyToPem(this._keys.privateKey);
  }
  public get publicKey(): string {
    return forge.pki.publicKeyToPem(this._keys.publicKey);
  }
  public get certificate(): string {
    return forge.pki.certificateToPem(this._certificate);
  }

}