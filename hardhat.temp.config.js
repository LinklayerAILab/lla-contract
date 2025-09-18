module.exports = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
      viaIR: true,
    },
  },
};