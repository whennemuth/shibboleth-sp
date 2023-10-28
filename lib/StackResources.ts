import { CfnOutput, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { IContext } from '../context/IContext';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { FunctionUrl, FunctionUrlAuthType, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Distribution, LambdaEdgeEventType, OriginProtocolPolicy, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

export class LambdaShibbolethStackResources extends Construct {
  constructor(stack: Construct, stackName: string, props?: any) {
    super(stack, stackName);

    const context:IContext = stack.node.getContext('stack-parms');

    // Lambda@Edge function
    const edgeFunction = new NodejsFunction(stack, 'EdgeFunction', {
      runtime: Runtime.NODEJS_18_X,
      entry: 'lambda/sp.mjs',
      timeout: Duration.seconds(10),
      bundling: {
        externalModules: [ '@aws-sdk/*' ],
      },
      role: new Role(stack, 'LambdaRole', {
        assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
        inlinePolicies: {
          "ReadSecretsManager": new PolicyDocument({
            statements: [
              new PolicyStatement({
                actions: [ 'secretsmanager:GetSecretValue', 'secretsmanager:ListSecrets' ],
                effect: Effect.ALLOW,
                resources: [ '*' ],    
              })
            ]
          })
        },
      }),
    });

    // Simple lambda-based web app
    const appFunction = new NodejsFunction(stack, 'AppFunction', {
      runtime: Runtime.NODEJS_18_X,
      entry: 'lambda/app.mjs',
      timeout: Duration.seconds(10),
      functionName: 'AppFunction',      
    });

    // Lambda function url for the web app.
    const appFuncUrl = new FunctionUrl(appFunction, 'Url', {
      function: appFunction,
      authType: FunctionUrlAuthType.AWS_IAM,
    })

    // CloudFront Distribution
    const cloudFrontDistribution = new Distribution(stack, 'MyCloudFrontDistribution', {
      defaultBehavior: {
        origin: new HttpOrigin(appFuncUrl.url, {
          protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,        
        }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        edgeLambdas: [{
          eventType: LambdaEdgeEventType.VIEWER_REQUEST,
          functionVersion: edgeFunction.currentVersion,
        }]
      },
    });

    // appFuncUrl.grantInvokeUrl(edgeFunction);
  
  //   {
  //     "Version": "2012-10-17",
  //     "Statement": [
  //         {
  //             "Effect": "Allow",
  //             "Principal": {
  //               "Service": "cloudfront.amazonaws.com"
  //             },
  //             "Action": "lambda:InvokeFunctionUrl",
  //             "Resource": "arn:aws:lambda:us-east-1:123456789012:function:my-function",
  //             "Condition": {
  //                 "StringEquals": {
  //                     "lambda:FunctionUrlAuthType": "AWS_IAM"
  //                 }
  //             }
  //         }
  //     ]
  // }

    // Outputs
    new CfnOutput(stack, 'CloudFrontDistributionURL', {
      value: `https://${cloudFrontDistribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL',
    });

  }
}
