export const getSampleSamlResponseXML = (certificate:string) => {
  return '<saml2p:Response xmlns:saml2p="urn:oasis:names:tc:SAML:2.0:protocol" \
      Destination="https://stg.kualitest.research.bu.edu/auth/saml/consume?redirect_to=/auth/authorize" \
      ID="_5ae9e7ec36cd5c6c5c7463b3c50468ad" \
      InResponseTo="_706217a6cee7dbf456f1" \
      IssueInstant="2023-11-06T06:11:56.213Z" \
      Version="2.0" \
      xmlns:xsd="http://www.w3.org/2001/XMLSchema"\
    > \
      <saml2:Issuer xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion">https://shib.bu.edu/idp/shibboleth</saml2:Issuer> \
      <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"> \
        <ds:SignedInfo> \
          <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#" /> \
          <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha512" /> \
          <ds:Reference URI="#_5ae9e7ec36cd5c6c5c7463b3c50468ad"> \
            <ds:Transforms> \
              <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature" /> \
              <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"> \
                  <ec:InclusiveNamespaces xmlns:ec="http://www.w3.org/2001/10/xml-exc-c14n#" PrefixList="xsd" /> \
              </ds:Transform> \
            </ds:Transforms> \
            <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha512" /> \
            <ds:DigestValue>DIGEST_VALUE_PLACEHOLDER</ds:DigestValue> \
          </ds:Reference> \
        </ds:SignedInfo> \
        <ds:SignatureValue>SIGNATURE_PLACEHOLDER</ds:SignatureValue> \
        <ds:KeyInfo> \
          <ds:X509Data> \
            <ds:X509Certificate>CERT_PLACEHOLDER</ds:X509Certificate> \
          </ds:X509Data> \
        </ds:KeyInfo> \
      </ds:Signature> \
      <saml2p:Status> \
        <saml2p:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success" /> \
      </saml2p:Status> \
      <saml2:Assertion xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion" \
        ID="_010cec5626db25c57ba06bfcd084f8ba" \
        IssueInstant="2023-11-06T06:11:56.213Z" \
        Version="2.0" \
        xmlns:xsd="http://www.w3.org/2001/XMLSchema" \
      > \
        <saml2:Issuer>https://shib.bu.edu/idp/shibboleth</saml2:Issuer> \
        <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"> \
          <ds:SignedInfo> \
            <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#" /> \
            <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha512" /> \
            <ds:Reference URI="#_010cec5626db25c57ba06bfcd084f8ba"> \
              <ds:Transforms> \
                  <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature" /> \
                  <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"> \
                      <ec:InclusiveNamespaces xmlns:ec="http://www.w3.org/2001/10/xml-exc-c14n#" PrefixList="xsd" /> \
                  </ds:Transform> \
              </ds:Transforms> \
              <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha512" /> \
              <ds:DigestValue>DIGEST_PLACEHOLDER</ds:DigestValue> \
            </ds:Reference> \
          </ds:SignedInfo> \
          <ds:SignatureValue>SIGNATURE_PLACEHOLDER</ds:SignatureValue> \
          <ds:KeyInfo> \
            <ds:X509Data> \
                <ds:X509Certificate>CERT_PLACEHOLDER</ds:X509Certificate> \
            </ds:X509Data> \
          </ds:KeyInfo> \
        </ds:Signature> \
        <saml2:Subject> \
          <saml2:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient" \
            NameQualifier="https://shib.bu.edu/idp/shibboleth" \
            SPNameQualifier="https://*.kualitest.research.bu.edu/shibboleth" \
            xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion" \
          >NAME_ID_PLACEHOLDER</saml2:NameID> \
          <saml2:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"> \
            <saml2:SubjectConfirmationData Address="73.234.17.9" \
              InResponseTo="_706217a6cee7dbf456f1" \
              NotOnOrAfter="2023-11-06T06:16:56.216Z" \
              Recipient="https://stg.kualitest.research.bu.edu/auth/saml/consume?redirect_to=/auth/authorize" \
            /> \
          </saml2:SubjectConfirmation> \
        </saml2:Subject> \
        <saml2:Conditions NotBefore="2023-11-06T06:11:56.213Z" NotOnOrAfter="2023-11-06T06:16:56.213Z" > \
          <saml2:AudienceRestriction> \
            <saml2:Audience>https://*.kualitest.research.bu.edu/shibboleth</saml2:Audience> \
          </saml2:AudienceRestriction> \
        </saml2:Conditions> \
        <saml2:AuthnStatement AuthnInstant="2023-11-06T06:11:56.205Z" SessionIndex="_5ab864d2f181a953773364f6e111eb61" > \
          <saml2:SubjectLocality Address="73.234.17.9" /> \
          <saml2:AuthnContext> \
            <saml2:AuthnContextClassRef>http://www.duosecurity.com/</saml2:AuthnContextClassRef> \
          </saml2:AuthnContext> \
        </saml2:AuthnStatement> \
        <saml2:AttributeStatement> \
          <saml2:Attribute FriendlyName="eduPersonPrimaryAffiliation" \
            Name="urn:oid:1.3.6.1.4.1.5923.1.1.1.5" \
            NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" \
          > \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >staff</saml2:AttributeValue> \
            </saml2:Attribute> \
            <saml2:Attribute FriendlyName="sn" \
              Name="urn:oid:2.5.4.4" \
              NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" \
            > \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >Hennemuth</saml2:AttributeValue> \
            </saml2:Attribute> \
            <saml2:Attribute FriendlyName="eduPersonPrincipalName" \
              Name="urn:oid:1.3.6.1.4.1.5923.1.1.1.6" \
              NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" \
            > \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >wrh@bu.edu</saml2:AttributeValue> \
            </saml2:Attribute> \
            <saml2:Attribute FriendlyName="title" \
              Name="urn:oid:2.5.4.12" \
              NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" \
            > \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >Lead Analyst, Programmer</saml2:AttributeValue> \
            </saml2:Attribute> \
            <saml2:Attribute FriendlyName="mail" \
              Name="urn:oid:0.9.2342.19200300.100.1.3" \
              NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" \
            > \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >wrh@bu.edu</saml2:AttributeValue> \
            </saml2:Attribute> \
            <saml2:Attribute FriendlyName="eduPersonAffiliation" \
              Name="urn:oid:1.3.6.1.4.1.5923.1.1.1.1" \
              NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" \
            > \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >member</saml2:AttributeValue> \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >staff</saml2:AttributeValue> \
            </saml2:Attribute> \
            <saml2:Attribute FriendlyName="buPrincipal" \
              Name="urn:oid:1.3.6.1.4.1.9902.2.1.9" \
              NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" \
            > \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >wrh</saml2:AttributeValue> \
            </saml2:Attribute> \
            <saml2:Attribute FriendlyName="givenName" \
              Name="urn:oid:2.5.4.42" \
              NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" \
            > \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >Warren</saml2:AttributeValue> \
            </saml2:Attribute> \
            <saml2:Attribute FriendlyName="o" \
              Name="urn:oid:2.5.4.10" \
              NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" \
            > \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >IS&T APPLICATIONS - Res. Adm. Web and .NET</saml2:AttributeValue> \
          </saml2:Attribute> \
          <saml2:Attribute FriendlyName="eduPersonEntitlement" \
            Name="urn:oid:1.3.6.1.4.1.5923.1.1.1.7" \
            NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri" \
          > \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >http://iam.bu.edu/sp/amazon-730096353738-InfraMgt</saml2:AttributeValue> \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >http://iam.bu.edu/sp/amazon-115619461932-InfraMgt</saml2:AttributeValue> \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >http://iam.bu.edu/sp/amazon-586030668166-CFarchitect</saml2:AttributeValue> \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
              >http://iam.bu.edu/sp/amazon-037860335094-InfraMgt</saml2:AttributeValue> \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >http://iam.bu.edu/sp/amazon-502886588882-CFarchitect</saml2:AttributeValue> \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >http://iam.bu.edu/hr/OrgUnitParent/10002129</saml2:AttributeValue> \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >http://iam.bu.edu/sp/amazon-253997709890-CFarchitect</saml2:AttributeValue> \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >http://iam.bu.edu/member/ist</saml2:AttributeValue> \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >http://iam.bu.edu/sp/amazon-253997709890-InfraMgt</saml2:AttributeValue> \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >http://iam.bu.edu/sp/amazon-586030668166-InfraMgt</saml2:AttributeValue> \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >http://iam.bu.edu/sp/amazon-730096353738-CFarchitect</saml2:AttributeValue> \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >http://iam.bu.edu/sp/amazon-037860335094-CFarchitect</saml2:AttributeValue> \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >http://iam.bu.edu/sp/amazon-347521306307-CFarchitect</saml2:AttributeValue> \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >http://iam.bu.edu/sp/amazon-770203350335-CFarchitect</saml2:AttributeValue> \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >http://iam.bu.edu/sp/amazon-115619461932-CFarchitect</saml2:AttributeValue> \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >http://iam.bu.edu/idinfo/83</saml2:AttributeValue> \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >http://iam.bu.edu/hr/OrgUnit/10003827</saml2:AttributeValue> \
            <saml2:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
              xsi:type="xsd:string" \
            >http://iam.bu.edu/sp/amazon-770203350335-InfraMgt</saml2:AttributeValue> \
          </saml2:Attribute> \
        </saml2:AttributeStatement> \
      </saml2:Assertion> \
    </saml2p:Response>'
      .replace(/CERT_PLACEHOLDER/g, certificate);
}

/**
 * Provides a mock SAMLResponse form data value that is returned by the IDP.
 * @param certificate 
 * @returns 
 */
export const getSampleSamlResponseBase64 = (certificate:string) => {    
  // fs.writeFileSync('SAMLResponse.xml', samlResponse);
  const samlResponse = getSampleSamlResponseXML(certificate);
  const bufferObj = Buffer.from(`SAMLResponse=${samlResponse}`, "utf8");
  // const bufferObj = Buffer.from('<saml2p:Response/>', "utf8");
  return bufferObj.toString("base64");
}