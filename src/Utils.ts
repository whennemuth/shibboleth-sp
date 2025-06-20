import { Request } from 'express';
import { IRequest, RequestBody, RequestHeaders } from './Http';

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

export const instanceOf = <T>(value: any, fieldName: string): value is T => fieldName in value;


type ReplacerFunction = (key: string, value: any) => any;
type ReplacerArray = (string | number)[];
type Replacer = ReplacerFunction | ReplacerArray | null;
type Space = string | number | null;

export const safeStringify = (
  obj: any,
  replacer?: Replacer,
  space?: Space
): string | undefined => {
  // Handle array replacer by converting to a function
  let replaceFn: ReplacerFunction | null = null;
  if (typeof replacer === 'function') {
    replaceFn = replacer;
  } else if (Array.isArray(replacer)) {
    const allowList = new Set(replacer.map(String));
    replaceFn = (key, value) => (key === '' || allowList.has(key) ? value : undefined);
  }

  // Track visited objects to detect circular references
  const visited = new WeakSet();

  const _serialize = (value: any, key: string = ''): string | undefined => {
    // Apply replacer function if provided
    const replacedValue = replaceFn ? replaceFn(key, value) : value;

    // Handle undefined and functions
    if (replacedValue === undefined || typeof replacedValue === 'function') {
      return undefined;
    }

    // Handle null and non-objects
    if (replacedValue === null || typeof replacedValue !== 'object') {
      return JSON.stringify(replacedValue);
    }

    // Handle built-in objects
    if (replacedValue instanceof Date) {
      return JSON.stringify(replacedValue);
    }
    if (replacedValue instanceof RegExp) {
      return JSON.stringify(replacedValue.toString());
    }
    if (replacedValue instanceof Map || replacedValue instanceof Set) {
      return '{}';
    }

    // Handle circular references
    if (visited.has(replacedValue)) {
      return '"[Circular]"';
    }
    visited.add(replacedValue);

    try {
      // Process arrays
      if (Array.isArray(replacedValue)) {
        const items = replacedValue.map((item, i) => {
          const serialized = _serialize(item, String(i));
          return serialized === undefined ? 'null' : serialized;
        });
        return `[${items.join(',')}]`;
      }

      // Process objects
      const entries: string[] = [];
      for (const [k, v] of Object.entries(replacedValue)) {
        const serialized = _serialize(v, k);
        if (serialized !== undefined) {
          entries.push(`${JSON.stringify(k)}:${serialized}`);
        }
      }
      return `{${entries.join(',')}}`;
    } finally {
      // Clean up visited set for recursive structures
      visited.delete(replacedValue);
    }
  };

  try {
    const result = _serialize(obj);
    if (space) {
      return JSON.stringify(JSON.parse(result || 'null'), null, space);
    }
    return result;
  } catch {
    return '{}';
  }
}