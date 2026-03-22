// Register Prism Oracle as an ERC-8004 agent on Base Sepolia
// ERC-8004 Identity Registry: 0x8004A818BFB912233c491871b3d84c89A494BD9e (Base Sepolia)
const { ethers } = require("ethers");
require("dotenv").config();

const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";

// Minimal ABI for registration
const REGISTRY_ABI = [
  "function register(string calldata metadataURI) external returns (uint256)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function balanceOf(address owner) external view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
  const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);

  console.log("Agent wallet:", wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    console.log("\nNo ETH! Get testnet ETH from:");
    console.log("  https://www.alchemy.com/faucets/base-sepolia");
    console.log("  https://faucet.quicknode.com/base/sepolia");
    console.log("  Wallet: " + wallet.address);
    process.exit(1);
  }

  const registry = new ethers.Contract(IDENTITY_REGISTRY, REGISTRY_ABI, wallet);

  // Check if already registered
  const existingBalance = await registry.balanceOf(wallet.address);
  if (existingBalance > 0n) {
    console.log("Already registered! Token balance:", existingBalance.toString());
    return;
  }

  // Agent metadata — stored as data URI for simplicity
  const metadata = {
    name: "Prism Oracle",
    description: "Structural trust analysis for infrastructure code. 8 targets analyzed with conservation laws and exploit surfaces. Opus/Sonnet/Haiku via cognitive prisms.",
    image: "",
    external_url: "https://oracle.agentskb.com",
    attributes: [
      { trait_type: "type", value: "code-analysis" },
      { trait_type: "models", value: "opus-4,sonnet-4,haiku-4.5" },
      { trait_type: "prisms", value: "58+" },
      { trait_type: "targets_analyzed", value: "8" },
      { trait_type: "conservation_laws", value: "6" },
      { trait_type: "payment", value: "x402-usdc" },
      { trait_type: "network", value: "base" }
    ],
    services: {
      api: "https://oracle.agentskb.com/analyze",
      health: "https://oracle.agentskb.com/health",
      x402: true,
      a2a: false,
      mcp: false
    }
  };

  const metadataURI = "data:application/json;base64," +
    Buffer.from(JSON.stringify(metadata)).toString("base64");

  console.log("\nRegistering Prism Oracle on ERC-8004...");
  const tx = await registry.register(metadataURI);
  console.log("TX:", tx.hash);
  const receipt = await tx.wait();
  console.log("Confirmed in block:", receipt.blockNumber);

  // Find the token ID from Transfer event
  const transferLog = receipt.logs.find(l => l.topics[0] === ethers.id("Transfer(address,address,uint256)"));
  if (transferLog) {
    const tokenId = ethers.toBigInt(transferLog.topics[3]);
    console.log("\nERC-8004 Token ID:", tokenId.toString());
    console.log("View on Basescan: https://sepolia.basescan.org/token/" + IDENTITY_REGISTRY + "?a=" + tokenId.toString());
  }

  console.log("\nDone! Prism Oracle is now a registered ERC-8004 agent.");
}

main().catch(console.error);
