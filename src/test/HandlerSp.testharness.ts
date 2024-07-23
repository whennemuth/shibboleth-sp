import * as mockRequestJson from './HandlerSp.mock.request.json';
import { handler } from '../HandlerSp';
import { IRequest } from '../Http';
import { IConfig, getConfigFromEnvironment } from '../Config';

// Assumes running from a launch configuration that references a "${workspaceFolder}/.env" file as envFile property
const config = getConfigFromEnvironment() as IConfig;
const mockRequest = mockRequestJson as IRequest;

handler(mockRequest, config).then((response) => {
  JSON.stringify(response, null, 2);
})