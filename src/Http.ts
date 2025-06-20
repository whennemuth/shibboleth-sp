import { instanceOf, ParameterTester } from "./Utils";
import { Request, Response } from 'express';

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
 * Convert express.Request to IRequest.
 * @param {*} req A complete express request object
 * @returns An object implementing the simpler IRequest interface.
 */
export const transformExpressRequest = (req:Request): IRequest => {
  let { url, method, headers:headersIn, body:rawBody } = req;

  // Reform headers
  const headersOut = {} as RequestHeaders;
  Object.keys(headersIn).forEach(key => {
    headersOut[key.toLowerCase()] = [{
      key, value: req.header(key) as string
    }]    
  });

  // Get the uri and querystring
  const parts = url.split('?');
  const uri = parts[0];
  const querystring = parts.length > 1 ? parts[1] : '';

  // Reform the body
  let body = { data: {}} as RequestBody;
  rawBody = rawBody || {};
  if(Object.keys(rawBody).length > 0) {
    const bodyString = Object.keys(rawBody).map(key => `${key}=${encodeURIComponent(rawBody[key])}`).join('&');
    body = {
      data: Buffer.from(bodyString, 'utf8').toString('base64')
    }
  }

  return {
    body, headers: headersOut, method, querystring, uri, headerActivity: { added:{}, modified:{}, removed:{}}        
  } as IRequest;
}

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

/**
 * 
 * @param req 
 * @returns The href of a request, which is the full URL including protocol, host, port, path, and querystring.
 */
export const getHref = (req:Request): string => {
  let { protocol, originalUrl, url } = req;
  const host = req.get('host');
  originalUrl = originalUrl || url;
  return `${protocol}://${host}${originalUrl}`;
}

export const changeToHttps = (url:URL|string):URL => {
  const _url = new URL(url);
  if(_url.protocol !== 'https:') {
    _url.protocol = 'https:';
  }
  return _url;
}

export const redirectToHttps = (req:Request, res:Response):void => {
  console.log(`Redirecting to https: ${getHref(req)}`);
  const httpsHref = changeToHttps(getHref(req));
  res.redirect(httpsHref.href);
}
