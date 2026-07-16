import { defineChain } from 'viem';

export const arbitrumLocal = defineChain({
  id: 412346,
  name: 'Arbitrum Local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://localhost:8547'] },
  },
  testnet: true,
});
