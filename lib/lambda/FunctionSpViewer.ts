
/**
 * This is a lambda@edge function for viewer response traffic from the application lambda function origin.
 * The purpose of this function is simply to intercept response output from the application lambda.
 * so that the "application/json" content type can be changed to "text/html" so the browser will format
 * content properly.
  */
export const handler =  async (event:any) => {

  try {
    const response = event.Records[0].cf.response;
    const json = JSON.stringify(event, null, 2);
    console.log(json);

    if(response.headers && response.headers['content-type']) {
      if (response.headers['content-type'][0].value === 'application/json') {
        response.headers['content-type'][0].value = 'text/html';
      }
    }

    response.body = '<html> \
      <body> \
        <h1>This is the application origin</h1> \
      </body> \
    </html>';
    
    return response;
  } 
  catch (error:any) {
    return {
      status: 501,
      body: `Viewer response lambda error: ${error.message}`
    }
  }
}