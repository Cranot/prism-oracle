const hre = require("hardhat");

async function main() {
  console.log("Deploying PrismReceipts to", hre.network.name, "...");

  const PrismReceipts = await hre.ethers.getContractFactory("PrismReceipts");
  const contract = await PrismReceipts.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("PrismReceipts deployed to:", address);
  console.log("Agent (owner):", await contract.agent());
  console.log("");
  console.log("Add to .env:");
  console.log(`RECEIPTS_CONTRACT=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
