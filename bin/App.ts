#!/usr/bin/env node
import 'source-map-support/register';
import { LambdaShibbolethStackResources } from '../lib/StackResources';
import { IContext, Convert } from '../context/IContext';
import * as fs from 'fs';
import { App, Stack } from 'aws-cdk-lib';

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

new LambdaShibbolethStackResources(stack, stackName);

// Alternative?: https://docs.aws.amazon.com/solutions/latest/constructs/aws-alb-lambda.html