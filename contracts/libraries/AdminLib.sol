// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ProductItem} from "./ProductLib.sol";

library AdminLib {
    


    /**
     * 添加支持的代币
     */
    function addSupportedToken(
        address token,
        mapping(address => bool) storage supportedTokens,
        mapping(address => uint8) storage tokenDecimals
    ) internal {
        supportedTokens[token] = true;
        
        try ERC20(token).decimals() returns (uint8 decimals) {
            require(decimals <= 18, "Unsupported decimals");
            tokenDecimals[token] = decimals;
        } catch {
            tokenDecimals[token] = 18;
        }
    }

    /**
     * 移除支持的代币
     */
    function removeSupportedToken(
        address token,
        mapping(address => bool) storage supportedTokens,
        mapping(address => uint8) storage tokenDecimals
    ) internal {
        supportedTokens[token] = false;
        tokenDecimals[token] = 0;
    }

    /**
     * 提取代币到多签钱包
     */
    function withdrawTokenToMultisig(
        address token,
        uint256 amount,
        address multisigWallet
    ) internal {
        require(multisigWallet != address(0), "Invalid multisig address");
        require(amount > 0, "Amount must be greater than 0");
        
        if (token == address(0)) {
            require(address(this).balance >= amount, "Insufficient ETH balance");
            payable(multisigWallet).transfer(amount);
        } else {
            ERC20 tokenContract = ERC20(token);
            require(tokenContract.balanceOf(address(this)) >= amount, "Insufficient token balance");
            tokenContract.transfer(multisigWallet, amount);
        }
    }

    /**
     * 提取所有代币到多签钱包
     */
    function withdrawAllTokensToMultisig(
        address[] calldata tokens,
        address multisigWallet
    ) internal {
        require(multisigWallet != address(0), "Invalid multisig address");
        
        // 提取ETH
        uint256 ethBalance = address(this).balance;
        if (ethBalance > 0) {
            payable(multisigWallet).transfer(ethBalance);
        }
        
        // 提取所有代币
        for (uint256 i = 0; i < tokens.length; i++) {
            ERC20 token = ERC20(tokens[i]);
            uint256 balance = token.balanceOf(address(this));
            if (balance > 0) {
                token.transfer(multisigWallet, balance);
            }
        }
    }
}