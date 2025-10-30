import { jest } from '@jest/globals';
import { SAMLAssertResponse, ServiceProvider } from 'saml2-js';
import { SamlResponseObject, SamlTools, SamlParms, getFriendlySamlResponse } from '../Saml';
import { Keys } from '../Keys';
import { getSampleSamlResponseXML, getSampleSamlResponseBase64 } from './SamlResponseMock'
import { MockSamlAssertResponse } from './SamlAssertResponseMock';
import { IRequest } from '../Http';

const samlToolParms = {
  entityId: 'https://shib-test.bu.edu/idp/shibboleth',
  entryPoint: 'https://shib-test.bu.edu/idp/profile/SAML2/Redirect/SSO',
  logoutUrl: 'https://shib-test.bu.edu/Shibboleth.sso/Logout'
} as SamlParms;
const domain = 'd129tjsl6pgy8.cloudfront.net';
const relayState = '/path/to/app'
const samlTools = new SamlTools(samlToolParms);
samlTools.setAssertUrl(`https://${domain}/assert?RelayState=${relayState}`);

const keys = new Keys();
samlTools.setPrivateKey(keys.privateKeyPEM);
samlTools.setSpCertificate(keys.certificatePEM);

// Authentication has succeeded, and the IDP has issued a SAMLResponse form parameter in a 302 request.
// This is a mock of such a request.
const mockSamlCallbackRequest = {
  uri: '/assert',
  querystring: '',
  method: "POST",
  statusCode: '302',
  clientIp: "2001:cdba::3257:9652",
  origin: 'https://shib-test.bu.edu',
  referer: 'https://shib-test.bu.edu/',
  body: {
    encoding: 'base64',
    inputTruncated: false,
    action: 'read-only',
    data: getSampleSamlResponseBase64(keys.certificate, relayState),
  },
  headers: {
    host: [
      {
        key: 'Host',
        value: `https://${domain}`
      }
    ],
    'user-agent': [
      {
        key: 'User-Agent',
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0'
      }
    ],
    'user-name': [
      {
        key: 'User-Name',
        value: 'aws-cloudfront'
      }
    ],
    'content-type': [
      {
        key: 'Content-Type',
        value: 'application/x-www-form-urlencoded'
      }
    ]
  },
  headerActivity: { added: {}, modified: {}, removed: {} },
} as IRequest

// Mock the post_assert function
ServiceProvider.prototype.post_assert = (idp, options, callback) => {
 callback(null, { 
    response_header: { 
      id: '_abc-1',
      destination: `https://${domain}/assert`,
      in_response_to: '_706217a6cee7dbf456f1'
    },
    type: 'authn_response',
    user: { 
      name_id: 'nameid',
      session_index: '_abc-3',
      attributes: { 
        'eduPersonPrimaryAffiliation': [ 'staff' ],
        'sn': [ 'Hennemuth' ],
        'eduPersonPrincipalName': [ 'wrh@bu.edu' ],
        'title': [ 'Lead Analyst, Programmer' ],
        'mail': [ 'wrh@bu.edu' ],
        'eduPersonAffiliation': [ 'member', 'staff' ],
        'buPrincipal': [ 'wrh' ],
        'givenName': [ 'Warren' ],
        'o': [ 'IS&T APPLICATIONS - Res. Adm. Web and .NET' ],
        'eduPersonEntitlement': [
          'http://iam.bu.edu/sp/amazon-730096353738-InfraMgt',
          'another', 'and', 'another', 'and', 'so on...'
        ]
      } 
    }
  });       
}


describe('Saml', () => {

  let samlResponse: SamlResponseObject | null;

  it('Should create the expected login url', async () => {
    const loginUrl = await samlTools.createLoginRequestUrl('https://d129tjsl6pgy8.cloudfront.net/some/path');
    expect(loginUrl).toBeDefined();
    const expectedStart = `${samlToolParms.entryPoint}?SAMLRequest=`
    const actualStart = loginUrl.substring(0, expectedStart.length);
    expect(actualStart).toEqual(expectedStart);
  });

  it('Should detect a samlResponse in the querystring of a request', () => {
    samlResponse = samlTools.getSamlResponseParameter({
      method: 'GET',
      uri: '/assert',
      body: { data: '' },
      headers: {},
      headerActivity: { added: {}, modified: {}, removed: {} },
      querystring: `RelayState=${relayState}&SAMLResponse=testing`
    });
    expect(samlResponse?.samlResponseParm).toEqual('testing');
  });

  it('Should detect a samlResponse in form data parameter of a request', () => {
    samlResponse = samlTools.getSamlResponseParameter(mockSamlCallbackRequest);
    expect(samlResponse).toBeDefined();
    const bufferObj = Buffer.from(samlResponse?.samlResponseParm || '', "base64");
    const decoded = bufferObj.toString("utf8");
    expect(decoded).toContain('<saml2:AttributeValue');
  });

  it('Should be able to properly restore friendly attribute names', () => {
    const xmlData = getSampleSamlResponseXML('dummy-cert');
    const friendly:SAMLAssertResponse|null = getFriendlySamlResponse(xmlData, MockSamlAssertResponse);
    expect(friendly).toBeDefined();
    expect(friendly).not.toBeNull();
    const attributes = friendly?.user.attributes;
    expect(attributes).toBeDefined();
    if(attributes) {
      const { title, eduPersonEntitlement, givenName, mail, o, eduPersonPrincipalName, 
              eduPersonAffiliation, eduPersonPrimaryAffiliation, surname, sn, buPrincipal} = attributes;
      const fn = attributes['urn:oid:1.3.6.1.4.1.5923.1.1.1.2'][0];

      expect(title[0]).toEqual('Lead Analyst, Programmer');
      expect(eduPersonEntitlement[0]).toEqual('http://iam.bu.edu/sp/amazon-253997709890-InfraMgt');
      expect(givenName[0]).toEqual('Warren');
      expect(mail[0]).toEqual('wrh@bu.edu');
      expect(o[0]).toEqual('IS&T APPLICATIONS - Res. Adm., Web and .NET');
      expect(eduPersonPrincipalName[0]).toEqual('wrh@bu.edu');
      expect(eduPersonAffiliation[0]).toEqual('employee');
      expect(surname[0]).toEqual('Hennemuth');
      expect(sn[0]).toEqual('Hennemuth');
      expect(buPrincipal[0]).toEqual('wrh');
      expect(eduPersonPrimaryAffiliation[0]).toEqual('staff');
      expect(fn).toEqual('Warren');
    }
  });

  it('Should produce the expected SAMLAssertResponse', async () => {
    const samlAssertResponse = await samlTools.sendAssert(mockSamlCallbackRequest);
    expect(samlAssertResponse).toBeDefined();
    expect(samlAssertResponse.relayState).toEqual(relayState);
    expect(samlAssertResponse.samlAssertResponse?.user.attributes?.buPrincipal[0]).toEqual('wrh');
  });
});

