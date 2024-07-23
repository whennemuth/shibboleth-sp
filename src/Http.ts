import { instanceOf, ParameterTester } from "./Utils";

/**
 * Interface for an incoming request.
 * 
 * NOTE: This was modelled after a Lambda@Edge request event, but that is arbitrary - this app is agnostic
 * as to which environment it will be run in (such as cloudfront edge lambda), docker compose, etc.
 * 
 * SEE: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-event-structure.html#lambda-event-structure-request
 */
export interface IRequest {
  uri:         string;
  method:      string;
  querystring: string
  clientIp?:   string;
  status?:     string;
  body:        RequestBody;
  headers:     RequestHeaders;
  headerActivity: {
    added:    RequestHeaders;
    removed:  RequestHeaders;
    modified: RequestHeaders;
  }
}

export interface IResponse {
  status:            string;
  statusDescription: string;
  body?:             string;
  headers?:          RequestHeaders;
}

export interface RequestBody {
  data: string
}

export type RequestHeaders = {
  [headerName: string]: KeyValuePair[];
}

export interface KeyValuePair {
  key:   string;
  value: string;
}

export type IHeaders = {
  empty: boolean;
  get: (key: string) => string|null;
  join: (joiner: string) => string;
  isTruthy: (key: string) => boolean;
}

/**
 * Header accessor wrapper.
 * @param request 
 * @returns 
 */
export const Headers = (request:IRequest|IResponse):IHeaders => {
  const { headers } = request;
  if(headers) {
    const get = (key:string):string|null => {
      if(headers[key.toLowerCase()]) {
        return headers[key.toLowerCase()][0].value;
      }
      return null;
    }
    const join = (joiner:string):string => {
      return Object.keys(headers).map(key => {
        return `${key}: ${get(key)}`
      }).join(joiner);
    }
    const isTruthy = (key:string):boolean => {
      return `${get(key)}`.toLowerCase() == 'true';
    }
    return { empty:false, get, join, isTruthy };
  }
  return { empty:true, get: () => null, join: () => '', isTruthy: () => false };
}

/**
 * Utility function for adding headers to a request or response
 * @param obj 
 * @param keyname 
 * @param value 
 * @returns 
 */
export const addHeader = (obj:IRequest|IResponse, keyname:string, value:string) => {
  const { isBlank } = ParameterTester;
  if(isBlank(value)) {
    console.log(`ERROR: attempt to set header ${keyname} with "${value}"`);
    return;
  }
  if(obj.headers) {
    obj.headers[keyname.toLowerCase()] = [{ key: keyname, value }];
    if(instanceOf<IRequest>(obj, "uri")) {
      // Be more specific as to header activity when it comes to IRequest instances
      obj.headerActivity.added[keyname.toLowerCase()] = [{ key: keyname, value }];
    }
  }
}
