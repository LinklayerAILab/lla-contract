#!/bin/bash

echo "=== Deploying ProductSubscription to Sepolia ==="
echo "Make sure your .env file contains all required variables:"
echo "- OWNER_ADDR (private key)"
echo "- PAUSER_ADDR (private key)"
echo "- TOKENMANAGER_ADDR (private key)"
echo "- UPGRADER_ADDR (private key)"
echo "- MULTISIG_ADDR (private key)"
echo ""

# Check if .env file exists
if [ ! -f .env.enc ]; then
    echo "Error: .env.enc file not found!"
    echo "Please make sure your environment variables are properly configured."
    exit 1
fi

echo "Starting deployment..."
npx hardhat run scripts/deployProductSubscription.ts --network sepolia

echo ""
echo "Deployment completed!"
echo "Check the deployments/ folder for deployment details."