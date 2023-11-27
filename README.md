# AWS Lambda-based shibboleth service provider

This is a sample project for the implementation of a shibboleth service provider in a [lambda@edge](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-the-edge.html) function.
All http requests go through a [cloudfront distribution](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-overview.html) which first passes them through the function to determine authentication status.
The request is processed by the function using the [saml2-js](https://www.npmjs.com/package/saml2-js) library to either verify authenticated status or drive the authentication process with the shibboleth IDP to get authenticated before passing through to the targeted [origin](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DownloadDistS3AndCustomOrigins.html).

## Testing

Part of testing includes mocking for lambda functions. In particular, it is helpful in typescript to have the [event object](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-concepts.html#gettingstarted-concepts-event) mocked.
The AWS article ["Using types for the event object"](https://docs.aws.amazon.com/lambda/latest/dg/typescript-handler.html#event-types) explains how to do this, but here are the relevant steps:

1. [Install the SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)

2. install [quicktype](https://quicktype.io/typescript):

   ```
   npm install -g quicktype
   ```

3. Create a sample event:

   ```
   cd lib/lambda/lib
   sam local generate-event cloudfront simple-remote-call > sp-event.json
   ```

4. Extract a type from the sample event:

   ```
   quicktype sp-event.json -o SimpleRemoteCall.ts
   ```

5. For any lambda entry-point file that expects to process such an event, you can now type the event object passed to the handler:

   ```
   import { SimpleRemoteCall, Request as BasicRequest } from './lib/SimpleRemoteCall';
   ...
   export const handler =  async (event:SimpleRemoteCall) => {
   ```

## References

- [Handling Redirects@Edge Part 1](https://aws.amazon.com/blogs/networking-and-content-delivery/handling-redirectsedge-part1/)
- [Securing and Accessing Secrets from Lambda@Edge using AWS Secrets Manager](https://aws.amazon.com/blogs/networking-and-content-delivery/securing-and-accessing-secrets-from-lambdaedge-using-aws-secrets-manager/)
- [saml2-js](https://www.npmjs.com/package/saml2-js)
- [Using Amazon CloudFront with AWS Lambda as origin to accelerate your web applications](https://aws.amazon.com/blogs/networking-and-content-delivery/using-amazon-cloudfront-with-aws-lambda-as-origin-to-accelerate-your-web-applications/)
- [support ticket](https://support.console.aws.amazon.com/support/home?region=us-east-1#/case/?displayId=14293173461&language=en)
  - [private-content-signed-cookies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-cookies.html)
  - [GeneratingCustomErrorResponses](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/GeneratingCustomErrorResponses.html)
  - [cognito-at-edge](https://github.com/awslabs/cognito-at-edge)
