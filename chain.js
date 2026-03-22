// On-chain integration for Prism Oracle
// Records analysis receipts on Base and provides ERC-8004 identity info

import { ethers } from 'ethers';

const RECEIPTS_ABI = [
  "function recordAnalysis(address requester, string calldata reportCID, uint256 costUSDC, uint256 depthScore, uint256 bugsFound) external returns (uint256)",
  "function getReceipt(uint256 id) external view returns (tuple(address requester, string reportCID, uint256 costUSDC, uint256 depthScore, uint256 bugsFound, uint256 timestamp))",
  "function totalAnalyses() external view returns (uint256)",
  "event AnalysisCompleted(uint256 indexed id, address indexed requester, string reportCID, uint256 costUSDC, uint256 depthScore, uint256 bugsFound, uint256 timestamp)"
];

const ERC8004_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e"; // Base Sepolia

let provider = null;
let wallet = null;
let receiptsContract = null;

export function initChain() {
  const rpcUrl = process.env.USE_TESTNET !== 'false'
    ? 'https://sepolia.base.org'
    : 'https://mainnet.base.org';

  try {
    provider = new ethers.JsonRpcProvider(rpcUrl);

    if (process.env.AGENT_PRIVATE_KEY) {
      wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);
      console.log(`Chain: connected to ${process.env.USE_TESTNET !== 'false' ? 'Base Sepolia' : 'Base Mainnet'}`);
      console.log(`Agent wallet: ${wallet.address}`);
    }

    if (process.env.RECEIPTS_CONTRACT && wallet) {
      receiptsContract = new ethers.Contract(process.env.RECEIPTS_CONTRACT, RECEIPTS_ABI, wallet);
      console.log(`Receipts contract: ${process.env.RECEIPTS_CONTRACT}`);
    }

    return true;
  } catch (err) {
    console.log(`Chain init failed: ${err.message}. On-chain features disabled.`);
    return false;
  }
}

export async function recordReceipt(requesterAddress, reportCID, costUSDC, depthScore, bugsFound) {
  if (!receiptsContract) {
    return { onchain: false, reason: 'No receipts contract configured' };
  }

  try {
    // Convert to contract format
    const costMicro = Math.round(costUSDC * 1e6); // USDC has 6 decimals
    const depthScaled = Math.round(depthScore * 10); // 9.3 → 93
    const requester = requesterAddress || ethers.ZeroAddress;

    const tx = await receiptsContract.recordAnalysis(
      requester,
      reportCID || '',
      costMicro,
      depthScaled,
      bugsFound
    );

    const receipt = await tx.wait();

    return {
      onchain: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      network: process.env.USE_TESTNET !== 'false' ? 'base-sepolia' : 'base',
      explorerUrl: `https://${process.env.USE_TESTNET !== 'false' ? 'sepolia.' : ''}basescan.org/tx/${tx.hash}`
    };
  } catch (err) {
    console.error('Receipt recording failed:', err.message);
    return { onchain: false, reason: err.message };
  }
}

export async function getAgentInfo() {
  const info = {
    wallet: wallet?.address || null,
    network: process.env.USE_TESTNET !== 'false' ? 'base-sepolia' : 'base',
    erc8004_registry: ERC8004_REGISTRY,
    receipts_contract: process.env.RECEIPTS_CONTRACT || null,
    balance: null,
    total_analyses_onchain: null
  };

  try {
    if (wallet) {
      const balance = await provider.getBalance(wallet.address);
      info.balance = ethers.formatEther(balance) + ' ETH';
    }
    if (receiptsContract) {
      const total = await receiptsContract.totalAnalyses();
      info.total_analyses_onchain = Number(total);
    }
  } catch (err) {
    // Non-critical
  }

  return info;
}
