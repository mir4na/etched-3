const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Deploying to Lisk Sepolia...");

    const CertificateSBT = await hre.ethers.getContractFactory("CertificateSBT");
    const contract = await CertificateSBT.deploy();

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log(`\n✅ Contract deployed to: ${address}`);
    console.log(`   Explorer: https://sepolia-blockscout.lisk.com/address/${address}`);

    // Save address for frontend/backend
    const deploymentInfo = {
        address: address,
        network: hre.network.name,
        chainId: hre.network.config.chainId,
        deployedAt: new Date().toISOString()
    };

    const deploymentPath = path.join(__dirname, "../deployment.json");
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n📄 Deployment info saved to ${deploymentPath}`);

    // Update frontend .env.local automatically if possible
    const frontendEnvPath = path.join(__dirname, "../../frontend/.env.local");
    try {
        let envContent = "";
        if (fs.existsSync(frontendEnvPath)) {
            envContent = fs.readFileSync(frontendEnvPath, "utf8");
        }

        // Replace or append
        const newContent = `NEXT_PUBLIC_CONTRACT_ADDRESS=${address}\nNEXT_PUBLIC_CHAIN_ID=4202\nNEXT_PUBLIC_API_BASE=http://localhost:8080`;

        fs.writeFileSync(frontendEnvPath, newContent);
        console.log("✅ Frontend configured automatically");
    } catch (err) {
        console.log("⚠️ Could not update frontend config automatically:", err.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
