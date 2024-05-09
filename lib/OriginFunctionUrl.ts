import { EdgeLambda, LambdaEdgeEventType, OriginProtocolPolicy } from "aws-cdk-lib/aws-cloudfront";
import { IContext, OriginFunctionUrl } from "../context/IContext";
import { HttpOrigin, HttpOriginProps } from "aws-cdk-lib/aws-cloudfront-origins";
import { Duration, Fn } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { FunctionUrl, FunctionUrlAuthType, Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export type OriginFunctionUrlConfig = {
  origin:OriginFunctionUrl,
  stack: Construct, 
  context: IContext, 
  edgeFunctionForOriginRequest:NodejsFunction|undefined, 
  edgeLambdas: EdgeLambda[]
}

export const getFunctionUrlOrigin = (config:OriginFunctionUrlConfig):HttpOrigin  => {
  const { origin } = config;
  if(origin.url) {
    throw new Error('Existing function url as origin not implemented yet.');
  }
  return getDummyLambdaAppOrigin(config);
}

export const DUMMY_BEHAVIOR_PATH = '/testing123/'

/**
 * Create an origin to add to the cloudfront distribution that targets a "dummy" target application
 * comprised of a single lambda function with a function url to address it by.
 */
const getDummyLambdaAppOrigin = (config:OriginFunctionUrlConfig):HttpOrigin => {
  const { origin, stack, context, edgeFunctionForOriginRequest, edgeLambdas } = config;
  const { APP_FUNCTION_NAME, EDGE_RESPONSE_VIEWER_FUNCTION_NAME } = context;
  const { appAuthorization=true } = origin;
    
  // Lambda@Edge viewer response function
  const edgeFunctionViewer = new NodejsFunction(stack, 'EdgeFunctionViewer', {
    runtime: Runtime.NODEJS_18_X,
    entry: 'lib/lambda/FunctionSpViewer.ts',
    functionName: EDGE_RESPONSE_VIEWER_FUNCTION_NAME,
  });

  // Simple lambda-based web app
  const appFunction = new NodejsFunction(stack, 'AppFunction', {
    runtime: Runtime.NODEJS_18_X,
    entry: 'lib/lambda/FunctionApp.ts',
    timeout: Duration.seconds(10),
    functionName: APP_FUNCTION_NAME,     
    environment: { APP_AUTHORIZATION: `${origin.appAuthorization}` }
  });

  // Lambda function url for the web app.
  const appFuncUrl = new FunctionUrl(appFunction, 'Url', {
    function: appFunction,
    // authType: FunctionUrlAuthType.AWS_IAM,
    authType: FunctionUrlAuthType.NONE,      
  });

  /**
   * This split function should take a function url like this:
   *    https://dg4qdeehraanv7q33ljsrfztae0fwyvz.lambda-url.us-east-2.on.aws/
   * and extract its domain like this:
   *    dg4qdeehraanv7q33ljsrfztae0fwyvz.lambda-url.us-east-2.on.aws
   * 'https://' is removed (Note: trailing '/' is also removed)
   */
  const funcUrlOrigin = new HttpOrigin(Fn.select(2, Fn.split('/', appFuncUrl.url)), {
    protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
    httpsPort: 443,
    customHeaders: {
      APP_AUTHORIZATION: `${appAuthorization}`
    }       
  } as HttpOriginProps);

  edgeLambdas.push({
    eventType: LambdaEdgeEventType.VIEWER_RESPONSE,
    functionVersion: edgeFunctionViewer.currentVersion,
  } as EdgeLambda);

  if(edgeFunctionForOriginRequest != undefined) {
    appFuncUrl.grantInvokeUrl(edgeFunctionForOriginRequest);
  }

  return funcUrlOrigin;
}