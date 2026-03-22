// Master setup script — run all on-chain setup in sequence
// Usage: node scripts/setup-all.cjs
//
// Prerequisites:
//   1. Agent wallet has testnet ETH on Base Sepolia
//   2. .env has AGENT_PRIVATE_KEY set
//
// Steps:
//   1. Check wallet balance
//   2. Deploy PrismReceipts contract
//   3. Register ERC-8004 identity
//   4. Update .env with contract address
//   5. Verify everything

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const REGISTRY_ABI = [
  "function register(string calldata metadataURI) external returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
  const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);

  console.log("=== Prism Oracle — On-Chain Setup ===\n");
  console.log("Agent wallet:", wallet.address);

  // Step 1: Check balance
  const balance = await provider.getBalance(wallet.address);
  const ethBalance = ethers.formatEther(balance);
  console.log("Balance:", ethBalance, "ETH\n");

  if (balance === 0n) {
    console.log("ERROR: No ETH! Get testnet ETH first:");
    console.log("  https://www.alchemy.com/faucets/base-sepolia");
    console.log("  https://faucet.quicknode.com/base/sepolia");
    console.log("  Wallet:", wallet.address);
    process.exit(1);
  }

  // Step 2: Deploy PrismReceipts
  console.log("--- Step 1: Deploy PrismReceipts ---");
  const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "PrismReceipts.sol", "PrismReceipts.json");

  if (!fs.existsSync(artifactPath)) {
    console.log("ERROR: Contract not compiled. Run: npx hardhat compile --config hardhat.config.cjs");
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  console.log("Deploying...");
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  console.log("PrismReceipts deployed:", contractAddress);
  console.log("Basescan: https://sepolia.basescan.org/address/" + contractAddress);

  // Step 3: Register ERC-8004
  console.log("\n--- Step 2: Register ERC-8004 Identity ---");
  const registry = new ethers.Contract(IDENTITY_REGISTRY, REGISTRY_ABI, wallet);

  const existing = await registry.balanceOf(wallet.address);
  if (existing > 0n) {
    console.log("Already registered on ERC-8004! Skipping.");
  } else {
    const metadata = {
      name: "Prism Oracle",
      description: "Structural trust analysis for infrastructure code. 8 targets, 6 conservation laws, exploit surfaces.",
      external_url: "https://oracle.agentskb.com",
      attributes: [
        { trait_type: "type", value: "code-analysis" },
        { trait_type: "payment", value: "x402-usdc" },
        { trait_type: "network", value: "base-sepolia" },
        { trait_type: "receipts_contract", value: contractAddress }
      ],
      services: {
        api: "https://oracle.agentskb.com/analyze",
        health: "https://oracle.agentskb.com/health"
      }
    };

    const metadataURI = "data:application/json;base64," +
      Buffer.from(JSON.stringify(metadata)).toString("base64");

    console.log("Registering...");
    const tx = await registry.register(metadataURI);
    console.log("TX:", tx.hash);
    const receipt = await tx.wait();
    console.log("Confirmed in block:", receipt.blockNumber);
    console.log("Basescan: https://sepolia.basescan.org/tx/" + tx.hash);
  }

  // Step 4: Update .env
  console.log("\n--- Step 3: Update .env ---");
  const envPath = path.join(__dirname, "..", ".env");
  let envContent = fs.readFileSync(envPath, "utf-8");

  if (envContent.includes("RECEIPTS_CONTRACT=")) {
    envContent = envContent.replace(/RECEIPTS_CONTRACT=.*/, `RECEIPTS_CONTRACT=${contractAddress}`);
  } else {
    envContent += `\nRECEIPTS_CONTRACT=${contractAddress}\n`;
  }
  fs.writeFileSync(envPath, envContent);
  console.log(".env updated with RECEIPTS_CONTRACT=" + contractAddress);

  // Step 5: Summary
  console.log("\n=== Setup Complete ===");
  console.log("Contract:  ", contractAddress);
  console.log("Wallet:    ", wallet.address);
  console.log("Network:    Base Sepolia");
  console.log("ERC-8004:   Registered");
  console.log("\nRestart the server to pick up the new contract address:");
  console.log("  kill the old server, then: node server.js");
}

main().catch(console.error);
