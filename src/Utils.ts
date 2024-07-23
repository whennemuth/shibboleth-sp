import { readFileSync } from 'node:fs';
import { IRequest, RequestBody, RequestHeaders } from './Http';
import { Request } from 'express';

const isBlank = (s:string|null|undefined):boolean => {
  return s === undefined || s === null || `${s}`.trim() == '';
}
const isNotBlank = (s:string|null|undefined) => !isBlank(s);
const anyBlank = (...a:any) => a.findIndex((s:any) =>  isBlank(s)) > -1;
const anyNotBlank = (...a:any) => a.findIndex((s:any) => isNotBlank(s)) > -1;
const allBlank = (...a:any) => !anyNotBlank(...a);
const noneBlank = (...a:any) => !anyBlank(...a);
const someBlankSomeNot = (...a:any) => anyBlank(...a) && anyNotBlank(...a);

export const ParameterTester = {
  isBlank, isNotBlank, anyBlank, anyNotBlank, allBlank, noneBlank, someBlankSomeNot
}

export const debugPrint = (value:string) => {
  if(process.env?.DEBUG == 'true') {
    console.log(`DEBUG: ${value}`);
  }
}

/**
 * Find the first field with a value in an object for the list of field names provided.
 * The field is assumed to be an array, and the value is the first element of it.
 * @param parentObj 
 * @param names 
 * @returns 
 */
export const findFirstFieldValue = (parentObj:any, ...names:any):string|null => {
  for(const name of names) {
    if(parentObj[name] && parentObj[name].length > 0) {
      if(parentObj[name][0]) {
        return parentObj[name][0];
      }
    }
  }
  return null;
}

export const debugLog = (msg:string) => {
  if(process.env?.DEBUG == 'true') {
    console.log(msg);
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
  };
}

export const instanceOf = <T>(value: any, fieldName: string): value is T => fieldName in value;
