
/**
 * This is a lambda function that represents an "application" that one will have access to after having
 * authenticated with the saml IDP. For now, it just returns the event object, formatted for html as <pre> 
 * element content.
 * 
 * NOTE:
 * If you hit the function url directly, the content type will always be "application/json" and therefore no
 * embedding in a stardard response object (with a "text/html" content-type) will remedy this.
 * However, when this output passes through the lambda@edge viewer response function, the content-type is switched
 * to "text/html", so if you come in through the public cloudfront distribution url, the formatting will be there.
 */
exports.handler = async (event:any) => {
  const responseBody = JSON.stringify(event, null, 2);
  let preContent = responseBody.replace(/\n/g, '<br>').replace(/\\"/g, '"');
  do {
    preContent = preContent.replace(/\\"/g, '"');
  } while(/\\"/.test(preContent));

  return `<pre>${preContent}</pre>`;
}