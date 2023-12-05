import * as contextJSON from '../../context/context.json';
import { JwtTools } from './lib/Jwt';

const context = contextJSON;

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
  // console.log(JSON.stringify(event, null, 2));
  const { headers, rawPath } = event;
  const userBase64 = headers['user-details'];
  const userJson = Buffer.from(userBase64, 'base64').toString();
  const userDetails = (JSON.parse(userJson))[JwtTools.TOKEN_NAME].user;
  const username = findFirstFieldValue(userDetails, 'givenName', 'eduPersonNickname', 'buPrincipal', 'mail');
  const rootUrl = decodeURIComponent(headers['root-url']);
  const faviconBase64 = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABhGlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV/TSkUqDnYQcchQXbSLijiWViyChdJWaNXB5NIvaNKQpLg4Cq4FBz8Wqw4uzro6uAqC4AeIq4uToouU+L+k0CLGg+N+vLv3uHsHCK0aU81ADFA1y8gk42K+sCoGXxGCHwGImJSYqaeyizl4jq97+Ph6F+VZ3uf+HINK0WSATySOMd2wiDeI5zYtnfM+cZhVJIX4nHjKoAsSP3JddvmNc9lhgWeGjVwmQRwmFss9LPcwqxgq8SxxRFE1yhfyLiuctzirtQbr3JO/MFTUVrJcpzmGJJaQQpo6ktFAFTVYiNKqkWIiQ/txD/+o40+TSyZXFYwcC6hDheT4wf/gd7dmaWbaTQrFgb4X2/4YB4K7QLtp29/Htt0+AfzPwJXW9ddbwPwn6c2uFjkChraBi+uuJu8BlzvAyJMuGZIj+WkKpRLwfkbfVACGb4GBNbe3zj5OH4AcdbV8AxwcAhNlyl73eHd/b2//nun09wOl3XK7fzzCVAAAAAZiS0dEAPcA0QAGZn/NAAAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAAd0SU1FB+cMAwYTIqDSv7EAAAAZdEVYdENvbW1lbnQAQ3JlYXRlZCB3aXRoIEdJTVBXgQ4XAAAB50lEQVRYw+2XsWsUQRSHvzczewkSBIlCUihYSEQwBkFRMJDKVhBSBISUCgYr04j5C9JYaJ3C3kZCwEoU7MRclTbBQgshkkLvbnfeszg0t5c7o3eb3Savm52dmW/e/H7DGzEwKgxHxVE5QOhsNOq1UhYdvdLqDSB7xshs2nvUWbDzYJeFeMsTL7mSj+AzyDtwL4xkISNZz6rVgH+iyJ4dLUBcdTTqNRqfajTfJtiC5Ppl10rKgAM7JcQbXb+PSbEu6J8KcLuG/6B/PumSoOPDA0jnTdh8n/R3QUfoY0c6H7DR4W04kAhly/CbsZBLfDCAdSPcjySvs6PVQFx1pLdDe6cR3DcjeZYhG+2t+xXFr+ynM33pidP+gFNG5tLcnP+fAWmj6oSgN4UiI/xz2lsgXxT3RssD8MuKX2717be7gryy8kX4e/F4x5V3BJwBuwA2Leg1Rzbj8dtaLICdlNJqguOSrBiArtHS7G3fvLWkOAA70VUfbB+0pPuaF6qNFZgBPS0w1bG550rYjMhPgxTcjuLX8gB6Tga0YR8PZQ894VFst79DWIwEYm/gB4JOumJFmM164tPDp7F7QroYhriI/iLEdD4Qryv+o+LqhmwZ/ACbEmxGiFcd8aIDf0hFVMXDRI4fp1UD/AJxjqN8NNTlNgAAAABJRU5ErkJggg==';

  console.log(`Username: ${username}`);
  
  let preContent = userJson.replace(/\n/g, '<br>').replace(/\\"/g, '"');
  do {
    preContent = preContent.replace(/\\"/g, '"');
  } while(/\\"/.test(preContent));

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-rbsA2VBKQhggwzxH7pPCaAqO46MgnOM80zW1RWuH61DGLwZJEdK2Kadq2F9CUG65" crossorigin="anonymous">
        <link rel="shortcut icon" href="data:image/x-icon;base64,${faviconBase64}" />
      </head>
      <body>
        <p style="padding:30px; font-weight:bold; font-size:24px;">
          Welcome, Warren <button id="btnSignin" class="btn btn-primary btn-lg" type="button" onclick="document.location.href = '${rootUrl}/logout';">Logout</button> 
        </p>
        <p style="padding-left:30px; font-size:16px;">Here is what shibboleth "said" about you:</p>
        <pre style='padding-left:30px;font-size:14px;'>${preContent}</pre>
      </body>
    </html>
  `;

}

/**
 * Find the first field with a value in an object for the list of field names provided.
 * The field is assumed to be an array, and the value is the first element of it.
 * @param parentObj 
 * @param names 
 * @returns 
 */
const findFirstFieldValue = (parentObj:any, ...names:any):string|null => {
  for(const name of names) {
    if(parentObj[name] && parentObj[name].length > 0) {
      if(parentObj[name][0]) {
        return parentObj[name][0];
      }
    }
  }
  return null;
}