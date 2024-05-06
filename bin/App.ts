#!/usr/bin/env node
import { App, Stack } from 'aws-cdk-lib';
import { BuildOptions, BuildResult, build } from 'esbuild';
import * as fs from 'fs';
import 'source-map-support/register';
import { Convert, IContext } from '../context/IContext';
import { LambdaShibbolethStackResources } from '../lib/StackResources';


const context:IContext = Convert.toIContext(fs.readFileSync('./context/context.json', 'utf-8'));

const app = new App();
app.node.setContext('stack-parms', context);
const stackName = `${context.STACK_ID}-${context.TAGS.Landscape}`;

const stack:Stack = new Stack(app, stackName, {
  stackName,
  description: 'Lambda-based shibboleth serice provider',
  env: {
    account: context.ACCOUNT,
    region: context.REGION
  },
  tags: {
    Service: context.TAGS.Service,
    Function: context.TAGS.Function,
    Landscape: context.TAGS.Landscape
  }
});

// Set the tags for the stack
var tags: object = context.TAGS;
for (const [key, value] of Object.entries(tags)) {
  stack.tags.setTag(key, value);
}

if( context.REGION != 'us-east-1' ) {
  // Gotta build the lambda code asset manually due to using EdgeLambda instead of NodejsFunction
  const { EDGE_REQUEST_ORIGIN_CODE_FILE:outfile } = LambdaShibbolethStackResources
  build({
    entryPoints: ['lib/lambda/FunctionSpOrigin.ts'],
    write: true,
    outfile,
    bundle: true,
    platform: 'node',
    external: ['@aws-sdk/*']
  } as BuildOptions)
  .then((result:BuildResult) => {
    new LambdaShibbolethStackResources(stack, stackName);
  })
  .catch((reason) => {
    console.log(JSON.stringify(reason, Object.getOwnPropertyNames(reason), 2));
  });
}
else {
  new LambdaShibbolethStackResources(stack, stackName);
}
