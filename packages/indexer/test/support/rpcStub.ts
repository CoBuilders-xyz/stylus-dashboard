import { createServer, type Server } from 'node:http';
import type { RpcBlock, RpcReceipt } from '../../src/helpers/evm';

const blocks = new Map<number, RpcBlock>();
const receipts = new Map<string, RpcReceipt>();
let server: Server | undefined;

export function stubBlock(blockNumber: number, block: RpcBlock, blockReceipts: Record<string, RpcReceipt> = {}): void {
  blocks.set(blockNumber, block);
  for (const [hash, receipt] of Object.entries(blockReceipts)) {
    receipts.set(hash, receipt);
  }
}

export function resetRpcStub(): void {
  blocks.clear();
  receipts.clear();
}

type RpcCall = { id: number; method: string; params: [string, ...unknown[]] };

export async function startRpcStub(): Promise<string> {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      const calls = JSON.parse(body) as RpcCall[];
      const reply = calls.map((call) => {
        if (call.method === 'eth_getBlockByNumber') {
          return { id: call.id, result: blocks.get(Number.parseInt(call.params[0], 16)) ?? null };
        }
        if (call.method === 'eth_getTransactionReceipt') {
          return { id: call.id, result: receipts.get(call.params[0]) ?? null };
        }
        return { id: call.id, error: { message: `unsupported method ${call.method}` } };
      });
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(reply));
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('RPC stub failed to bind a port');
  }
  return `http://127.0.0.1:${address.port}`;
}

export async function stopRpcStub(): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server ? server.close((err) => (err ? reject(err) : resolve())) : resolve(),
  );
  server = undefined;
}
