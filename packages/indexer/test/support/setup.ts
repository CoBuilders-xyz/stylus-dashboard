import { beforeAll, beforeEach, afterAll } from 'vitest';
import { startRpcStub, stopRpcStub, resetRpcStub } from './rpcStub';

let rpcUrl: string;

beforeAll(async () => {
  rpcUrl = await startRpcStub();
  process.env.DEVNODE_RPC_URL = rpcUrl;
});

beforeEach(() => {
  process.env.DEVNODE_RPC_URL = rpcUrl;
  resetRpcStub();
});

afterAll(async () => {
  delete process.env.DEVNODE_RPC_URL;
  await stopRpcStub();
});
