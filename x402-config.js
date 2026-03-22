// x402 Payment Configuration for Prism Oracle
// Coinbase x402 — HTTP-native micropayments on Base
//
// x402 integration is OPTIONAL. If the facilitator is unreachable
// or config is wrong, the server runs in free mode.

import { paymentMiddlewareFromConfig } from '@x402/express';

// Network config
const BASE_MAINNET = 'eip155:8453';
const BASE_SEPOLIA = 'eip155:84532';

const IS_TESTNET = process.env.USE_TESTNET !== 'false';
const NETWORK = IS_TESTNET ? BASE_SEPOLIA : BASE_MAINNET;

export const ANALYSIS_PRICE = '1.00'; // $1.00 USDC per analysis

export function createPaymentMiddleware(agentWalletAddress) {
  const facilitatorUrl = process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator';

  const routes = {
    'POST /analyze': {
      price: `$${ANALYSIS_PRICE}`,
      network: NETWORK,
      config: {
        description: 'Structural code analysis via cognitive prisms'
      }
    }
  };

  const facilitatorClients = {
    [NETWORK]: { url: facilitatorUrl }
  };

  // Don't sync on start — let it lazily connect
  return paymentMiddlewareFromConfig(routes, facilitatorClients, null, null, null, false);
}

export const paymentConfig = {
  network: NETWORK,
  price: ANALYSIS_PRICE,
  isTestnet: IS_TESTNET
};
