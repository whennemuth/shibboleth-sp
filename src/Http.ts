import { instanceOf, ParameterTester } from "./Utils";

/**
 * Interface for an incoming request.
 * 
 * @remarks This was modelled after a Lambda@Edge request event, but that is arbitrary - this app is agnostic
 * as to which environment it will be run in (such as cloudfront edge lambda), docker compose, etc.
 * 
 * @see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-event-structure.html#lambda-event-structure-request
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

/**
 * Interface for an outgoing response.
 * 
 * @remarks This was modelled after a Lambda@Edge response event, but that is arbitrary - this app is agnostic
 * as to which environment it will be run in (such as cloudfront edge lambda), docker compose, etc.
 * 
 * @see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-event-structure.html#lambda-event-structure-response
 */
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
  join: (joiner: string, except?:string[]) => string;
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
    const get = (key:string|null|undefined):string|null => {
      if(!key) {
        return null;
      }
      if(headers[key.toLowerCase()]) {
        return headers[key.toLowerCase()][0].value;
      }
      return null;
    }
    const join = (joiner:string, except:string[]=[]):string => {
      return Object.keys(headers).map(key => {
        return `${key}: ${get(key)}`
      })
      .filter(key => {
        return except.find(e => {
          return e.toLowerCase() == key.toLowerCase();
        }) == undefined;
      })
      .join(joiner);
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



/**
 * Extracts the host header value from an HTTP request.
 * @param request The HTTP request object
 * @returns The host header value, or null if not found or invalid request
 */
export const getHost = (request:IRequest):string|null => {
  if(!request || !request.headers) {
    return null;;
  }
  try {
    const headers = Headers(request);
    return headers.get('host');
  }
  catch(e:any) {
    console.log(`ERROR: Unable to determine host from request: ${JSON.stringify(request, null, 2)}`);
  }
  return null;
}


