const hre = require("hardhat");

async function main() {
  const CertificateSBT = await hre.ethers.getContractFactory("CertificateSBT");
  const contract = await CertificateSBT.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log("CertificateSBT deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
