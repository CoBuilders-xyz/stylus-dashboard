import { beforeAll, afterAll, beforeEach } from 'vitest';
import { startRpcStub, stopRpcStub, resetRpcStub } from './support/rpcStub';

beforeAll(async () => {
  process.env.DEVNODE_RPC_URL = await startRpcStub();
});

beforeEach(() => {
  resetRpcStub();
});

afterAll(async () => {
  await stopRpcStub();
});
