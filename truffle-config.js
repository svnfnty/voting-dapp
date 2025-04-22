const HDWalletProvider = require('@truffle/hdwallet-provider');
require('dotenv').config();

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*"
    },
    bnbTestnet: {
      provider: () => new HDWalletProvider({
        mnemonic: process.env.MNEMONIC,
        providerOrUrl: "https://bsc-testnet.infura.io/v3/05f766a012c44f80a36c8936e2995a44"
      }),
      network_id: 97, // BNB Smart Chain Testnet chain ID
      gas: 5000000,
      gasPrice: 10000000000, // 10 Gwei
      confirmations: 2,
      timeoutBlocks: 200,
      networkCheckTimeout: 10000
    }
  },
  compilers: {
    solc: {
      version: "0.8.0",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  }
};
