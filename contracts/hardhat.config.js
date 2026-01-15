require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { PRIVATE_KEY, SEPOLIA_RPC_URL, MUMBAI_RPC_URL, POLYGON_RPC_URL } = process.env;

module.exports = {
  solidity: "0.8.20",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    sepolia: {
      url: SEPOLIA_RPC_URL || "",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    },
    mumbai: {
      url: MUMBAI_RPC_URL || "",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    },
    polygon: {
      url: POLYGON_RPC_URL || "",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    }
  }
};
