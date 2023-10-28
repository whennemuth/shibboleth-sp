import { ServiceProvider, ServiceProviderOptions, IdentityProvider, 
         IdentityProviderOptions, SAMLAssertResponse } from 'saml2-js';
import * as contextJSON from '../../../context/context.json';

const context = contextJSON;
const { entityId, entryPoint, callbackUrl, logoutUrl, idpIssuer } = context.SHIBBOLETH;
         
export class SamlTools {

  private sp_options: ServiceProviderOptions = {
    entity_id: entityId,
    private_key: '',
    certificate: '',
    assert_endpoint: callbackUrl,
    force_authn: true,
    sign_get_request: true,
    allow_unencrypted_assertion: true,
  }

  private idp_options: IdentityProviderOptions = {
    sso_login_url: entryPoint,
    sso_logout_url: logoutUrl,
    sign_get_request: true,
    allow_unencrypted_assertion: true,
    force_authn: false,
    certificates: ''
  }

  public resetCertificate(cert:string) {
    this.sp_options.certificate = cert;
  }

  public resetPrivateKey(key:string) {
    this.sp_options.private_key = key;
  }

  /**
   * https://www.npmjs.com/package/saml2-js#create_login_request_urlidp-options-cb
   * @param originalRequestPath 
   * @returns 
   */
  public async createLoginRequestUrl(originalRequestPath:string): Promise<string> {
    return new Promise((resolve, reject) => {
      const sp = new ServiceProvider(this.sp_options);
      const idp = new IdentityProvider(this.idp_options);
      sp.create_login_request_url(idp, {
        relay_state: originalRequestPath
      }, (err, login_url, request_id) => {
        if(err) {
          reject(err);
        }
        resolve(login_url);
      });
    });  
  }

  /**
   * https://www.npmjs.com/package/saml2-js#create_login_request_urlidp-options-cb
   * @param requestUrl 
   * @returns 
   */
  public async redirectAssert(requestUrl:URL): Promise<SAMLAssertResponse> {
    return new Promise((resolve, reject) => {
      const sp = new ServiceProvider(this.sp_options);
      const idp = new IdentityProvider(this.idp_options);
      const SAMLRequest = requestUrl.searchParams.get('SAMLResponse');
      sp.redirect_assert(idp, {
        request_body: { SAMLRequest }
      }, (err:any, saml_response:SAMLAssertResponse) => {
        if(err) {
          reject(err);
        }
        resolve(saml_response);
      });
    });    
  }
}
