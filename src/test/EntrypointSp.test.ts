import { btoa } from 'buffer';
import { transformExpressRequest } from '../Utils';
import { Request } from 'express';

class ResponseMock {
  _status:number;
  headers:any;
  public status = (status:number) => {
    this._status = status;
    return this;
  }
  public set = (headers:any) => {
    this.headers = headers;
    return this;
  }
  public send = (data:string) => {
    console.log(`Sending data: ${data}`);
  }
};

class AxiosMock {
  url:string;
  private AxiosResponse = () => {
    return { headers: {}, data: [] }
  };
  public get = async (url:string, headers:any) => {
    this.url = url;
    return this.AxiosResponse();
  }
  public post = async (url:string, formdata:any, headers:any) => {
    this.url = url;
    return this.AxiosResponse();
  }
}

describe('entrypoint.js', () => {

  const port = '5000';
  const app_host = 'app';
  process.env.EXPRESS_PORT = port;
  process.env.DOCKER_APP_HOST = app_host;
  process.env.UNIT_TESTING = 'true';


  it('Should build a simple request object from http request as expected', () => {
    const headers = {
      key1: 'val1',
      key2: 'val2',
      key3: 'val3', 
      host: 'localhost:5000'
    } as any;
    const requestMock = {
      url: '/path/to/endpoint?this=that&these=those',
      method: 'GET', 
      headers,
      header: (key:string) => { return headers[key]; },
      body: {
        key1: 'val1', key2: 'val2', key3: 'val3'
      }
    };

    const request = transformExpressRequest(requestMock as Request);
    expect(request).toEqual({
      body: {
        data: btoa('key1=val1&key2=val2&key3=val3')
      },
      method: 'GET',
      querystring: 'this=that&these=those',
      uri: '/path/to/endpoint',
      headers: {
        key1: [ { key: 'key1', value: 'val1' }],
        key2: [ { key: 'key2', value: 'val2' }],
        key3: [ { key: 'key3', value: 'val3' }],
        host: [ { key: 'host', value: 'localhost:5000' }]
      },
      headerActivity: {
        added: {}, modified: {}, removed: {}
      }
    })
  });

  it('Should proxypass sp url to expected url of app host', async () => {
    const { proxypass } = require('../EntrypointSp.ts');
    const requestMock = {
      url: '/path/to/endpoint?this=that&these=those',
      method: 'GET',
      headers: {},
      body: [ 'request body' ]
    }
    const responseMock = new ResponseMock();
    const axiosMock = new AxiosMock();
    const appHost = `${app_host}`;
    const proxyPassParms = {
      req: requestMock,
      res: responseMock,
      axios: axiosMock,
      authResponse: {},
      appHost 
    };
    await proxypass(proxyPassParms);

    expect(axiosMock.url).toEqual(`https://${appHost}/path/to/endpoint?this=that&these=those`);
  });
});
