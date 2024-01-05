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

  private extractValueFromPEM = (pem:string) => {
    return pem.replace(/[\r\n]/g, '').split(/\-{2,}/)[2];
  }
  public get privateKey(): string {
    return this.extractValueFromPEM(this.privateKeyPEM);
  }
  public get publicKey(): string {
    return this.extractValueFromPEM(this.publicKeyPEM);
  }
  public get certificate(): string {
    return this.extractValueFromPEM(this.certificatePEM);
  }
  public get privateKeyPEM(): string {
    return forge.pki.privateKeyToPem(this._keys.privateKey);
  }
  public get publicKeyPEM(): string {
    return forge.pki.publicKeyToPem(this._keys.publicKey);
  }
  public get certificatePEM(): string {
    return forge.pki.certificateToPem(this._certificate);
  }
  public toString = () => {
    return JSON.stringify({
      privateKey: this.privateKey,
      publicKey: this.publicKey,
      certificate: this.certificate
    }, null, 2); 
  }
}
