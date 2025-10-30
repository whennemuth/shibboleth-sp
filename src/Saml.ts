import { ServiceProvider, ServiceProviderOptions, IdentityProvider, 
         IdentityProviderOptions, SAMLAssertResponse } from 'saml2-js';
import { DOMParser } from '@xmldom/xmldom';
import { IRequest } from './Http';

/**
 * Parameters required to configure the SAML tools.
 * 
 * @property entityId - The entity ID of your app known to shibboleth (e.g., 'https://*.myapp.bu.edu/shibboleth')
 * @property entryPoint - The IDP address for SSO (e.g., 'https://shib-test.bu.edu/idp/profile/SAML2/Redirect/SSO')
 * @property logoutUrl - The IDP logout URL (e.g., 'https://shib.bu.edu/idp/logout.jsp')
 * @property idpCert - The public certificate from the IDP's X509Certificate element
 * @property cert - Optional SAML certificate for your service provider metadata
 * @property key - Optional private key for your service provider metadata
 */
export interface SamlParms {
  entityId: string;
  entryPoint: string;
  logoutUrl: string;
  idpCert: string;
  cert?: string;
  key?: string;
}
   
export type SamlResponseObject = {
  samlResponseParm:string|undefined,
  xmlData:string|undefined,
  relayState:string|undefined
}

export type SendAssertResult = {
  samlAssertResponse:SAMLAssertResponse|null,
  relayState:string|null
}

export class SamlTools {

  private sp_options: ServiceProviderOptions;
  private idp_options: IdentityProviderOptions;

  constructor(parms: SamlParms) {

    const { entityId, entryPoint, logoutUrl, idpCert, cert, key } = parms;

    this.sp_options = {
      entity_id: entityId,
      private_key: '',
      certificate: '',
      assert_endpoint: '',
      force_authn: true,
      sign_get_request: true,
      allow_unencrypted_assertion: true,
      notbefore_skew: 60
    }

    if(cert) {
      this.sp_options.certificate = cert;
    }
    if(key) {
      this.sp_options.private_key = key;
    }

    this.idp_options = {
      sso_login_url: entryPoint,
      sso_logout_url: logoutUrl,
      sign_get_request: true,
      allow_unencrypted_assertion: true,
      force_authn: false,
      certificates: [ idpCert ]
    }
  }

  public setSpCertificate(cert:string) {
    this.sp_options.certificate = cert;
  }

  public setPrivateKey(key:string) {
    this.sp_options.private_key = key;
  }

  public setAssertUrl(assertEndpoint:string) {
    this.sp_options.assert_endpoint = assertEndpoint;
  }

  public getMetaData(): string {
    return (new ServiceProvider(this.sp_options)).create_metadata();
  }

  /**
   * The request indicates the user is not authenticated, and so needs to be redirected to a url for signin with the IDP.
   * 
   * @see https://www.npmjs.com/package/saml2-js#create_login_request_urlidp-options-cb
   * @param relay_state 
   * @returns 
   */
  public async createLoginRequestUrl(relay_state:string): Promise<string> {
    return new Promise((resolve, reject) => {
      const sp = new ServiceProvider(this.sp_options);
      const idp = new IdentityProvider(this.idp_options);
      sp.create_login_request_url(idp, {
        relay_state, 
      }, (err, login_url, request_id) => {
        if(err) {
          reject(err);
        }
        else {
          resolve(login_url);
        }        
      });
    });  
  }

  /**
   * @returns The url to the IDP to logout.
   */
  public async createLogoutRequestUrl(): Promise<string> {
    return new Promise((resolve, reject) => {
      const sp = new ServiceProvider(this.sp_options);
      const idp = new IdentityProvider(this.idp_options);
      sp.create_logout_request_url(idp, { }, (err, logout_url) => {
        if(err) {
          reject(err);
        }
        else {
          resolve(logout_url);
        }        
      });
    })
  }

  /**
   * The saml response could come from the IDP as either a querystring parameter (GET), or as a 
   * form data parameter (POST). 
   * @param request 
   * @returns 
   */
  public getSamlResponseParameter(request:IRequest):SamlResponseObject|null {

    let samlResponseParm;
    let xmlData;
    let relayState;

    try {
      if(request.method === 'GET') {
        // Check query string for SAMLResponse
        const queryStringParams = request.querystring ? new URLSearchParams(request.querystring) : null;
        const samlResponseFromQueryString = queryStringParams ? queryStringParams.get('SAMLResponse') : null;
        relayState = queryStringParams ? queryStringParams.get('RelayState') || undefined : undefined;

        if (samlResponseFromQueryString) {
          samlResponseParm = samlResponseFromQueryString;
        }
      }
      else if(request.method === 'POST') {
        /**
         * Check form data for SAMLResponse. 
         * ( If the redirect binding was used to initiate the authentication flow,
         *   shibboleth may nonetheless send the saml response as form data, perhaps because its size exceeds
         *   the limits of querystring parameters )
         */
        const ctheader = request.headers['content-type'];
        if(ctheader && ctheader[0].value === 'application/x-www-form-urlencoded') {

          // 1) The body data will be base64 encoded, decode it:
          const body = Buffer.from(request.body.data, 'base64').toString();

          // 2) Get the "SAMLResponse" parameter from within the body, url-decoded:
          const params = body ? new URLSearchParams(body) : null;
          samlResponseParm = params ? params.get('SAMLResponse') : null;
          samlResponseParm = samlResponseParm ? decodeURIComponent(samlResponseParm) : null;
          relayState = params ? params.get('RelayState') || '' : '';

          if(samlResponseParm) {
            console.log('SAMLResponse parameter FOUND in request');
            
            // 3) The "SAMLResponse" parameter will in turn be base64 encoded, decode it (you should find xml):
            xmlData = samlResponseParm ? Buffer.from(samlResponseParm, 'base64').toString(): undefined;
            // console.log(xmlData);            
          }
          else {
            throw new Error('SAMLResponse parameter NOT FOUND in request');
          }
        }
      }
    }
    catch(e) {
      console.log('Error getting SAMLResponse from request');
      throw(e);
    }
    return {
      samlResponseParm, xmlData, relayState
    };
  }

  /**
   * The request has a SAMLResponse parameter and so indicates authentication has completed and a followup
   * assert against the SAMLResponse parameter is next.
   * 
   * @see https://www.npmjs.com/package/saml2-js#create_login_request_urlidp-options-cb
   * @param requestUrl 
   * @returns 
   */
  public async sendAssert(request:IRequest): Promise<SendAssertResult> {
    return new Promise((resolve, reject) => {
      const sp = new ServiceProvider(this.sp_options);
      const idp = new IdentityProvider(this.idp_options);
      const parm = this.getSamlResponseParameter(request) as SamlResponseObject;
      const { samlResponseParm, xmlData, relayState } = parm;
      const options = {
        request_body: { SAMLResponse: samlResponseParm }
      }
      const callback = (err:any, saml_assert_response:SAMLAssertResponse) => {
        if(err) {
          reject(err);
        }
        else {
          const friendlyResponse:SAMLAssertResponse|null = getFriendlySamlResponse(xmlData, saml_assert_response);
          resolve({
            samlAssertResponse: friendlyResponse,
            relayState: relayState || null
          });
        }        
      };
      if(request.method === 'POST') {
        sp.post_assert(idp, options, callback);
      }
      else {
        sp.redirect_assert(idp, options, callback);
      }      
    });    
  }
}

  /**
   * The saml assert response will have attributes that are missing the friendly names.
   * These friendly names can still be found in the xml that was passed to the post_assert
   * to get the response, and can be applied to that response to overwrite the "unfriendly" names.
   * @param saml_assert_response 
   */
  export function getFriendlySamlResponse (xmlData:string|undefined, response:SAMLAssertResponse):SAMLAssertResponse|null {
    const xml:XMLDocument = (new DOMParser()).parseFromString(xmlData || '');
    const xmlChoices:HTMLCollectionOf<Element> = xml.getElementsByTagName('saml2:Attribute');
    const friendlyAttributes:any = { };
    const findFriendlyName = (unfriendlyName:string): string|null => {
      let item:Element|null = null;
      for(const itm in xmlChoices) {
        if( ! xmlChoices[itm].getAttribute) continue;
        if(xmlChoices[itm].getAttribute('Name') === unfriendlyName) {
          return xmlChoices[itm].getAttribute('FriendlyName');
        }
      }
      return null;
    }
    if(response?.user && response.user?.attributes) {
      const { attributes } = response.user;
      for(const a in attributes) {
        var fn = findFriendlyName(a);
        var val = attributes[a];
        if(fn) {
          friendlyAttributes[fn] = val;
        }
        else {
          friendlyAttributes[a] = val;
        }
      }
    }
    response.user.attributes = friendlyAttributes;
    return response;
  }
