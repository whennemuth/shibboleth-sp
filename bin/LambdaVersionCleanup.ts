import { LambdaClient, ListVersionsByFunctionCommand, ListVersionsByFunctionCommandOutput, DeleteFunctionCommand } from "@aws-sdk/client-lambda"
import { IContext, Convert } from '../context/IContext';
import * as fs from 'fs';

const context:IContext = Convert.toIContext(fs.readFileSync('./context/context.json', 'utf-8'));
const client = new LambdaClient();
process.env.AWS_REGION = context.REGION;
let dryrun:string;

if(process.argv.length > 2 && process.argv[2] === 'dryrun') {
  dryrun = 'true';
}

/**
 * This class represents a lambda function whose prior versions can be deleted.
 */
export class Lambda {
  private name:string;
  private versions:any[] = [];
  constructor(name:string) {
    this.name = name;
  }
  private loadVersions = async () => {
    if(this.versions.length == 0) {
      const command = new ListVersionsByFunctionCommand({ FunctionName: this.name });
      const output:ListVersionsByFunctionCommandOutput = await client.send(command);
      output.Versions?.forEach(version => {
        this.versions.push(getVersion(version.FunctionArn))
      })
    }
  }
  public dumpPriorVersions = async () => {
    await this.loadVersions();
    console.log('------------------------------------------------');
    console.log(`    Deleting versions for: ${this.name}`)
    console.log('------------------------------------------------');
    this.versions.forEach(async version => {
      if(version.isPriorVersion()) {
        version.delete();
      }
      else {
        console.log(`Leaving the latest version alone: ${version.version()}`)
      }
    })
  }
}

/**
 * Returns an object representing a lambda function of a prior version built from a specified arn.
 * @param arn 
 * @returns 
 */
function getVersion(arn:string|undefined) {
  const getArnPart = (fromRight:number) => {
    const parts:string[] = (arn||'').split(':');
    return parts[parts.length - fromRight];
  }
  const getVersion = () => getArnPart(1); 
  const getName = () => getArnPart(2); 
  return {
    asString: () => { return arn; },
    isPriorVersion: () => { return /\d+/.test(getVersion()); },
    version: () => { return getVersion(); },
    delete: async () => {
      const input = { 
        FunctionName: getName(),
        Qualifier: getVersion()
      };
      const command = new DeleteFunctionCommand(input);
      if(dryrun) {
        console.log(`Dryrun delete: ${JSON.stringify(input)}`);
      }
      else {
        console.log(`deleting ${JSON.stringify(input)}`);
        // const response = await client.send(command);
      }
    }
  }
};

/**
 * Delete all versions for all lambda functions
 */
function deleteVersions(functionList:string) {
  // 1) Get an array of all the lambda functions to process (from env as comma-delimited list)
  const functionArray:string[] = [];
  if(functionList) {
    functionArray.push(...functionList.split(/\x20*,\x20*/));
  }

  // 2) Delete all prior versions for each lambda function
  if(functionArray.length > 0) {
    functionArray.forEach((functionName:string) => {
      (new Lambda(functionName)).dumpPriorVersions();
    })
  }
  else {
    console.log('FUNCTION_NAMES is missing!');
  }
}

deleteVersions(
 `${context.EDGE_REQUEST_ORIGIN_FUNCTION_NAME}, \
  ${context.EDGE_RESPONSE_VIEWER_FUNCTION_NAME}, \
  ${context.APP_FUNCTION_NAME}`
);
