// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ProductItem} from "./ProductLib.sol";

library AdminLib {
    using SafeERC20 for IERC20;


    /**
     * 添加支持的代币 (安全修复版本)
     */
    function addSupportedToken(
        address token,
        mapping(address => bool) storage supportedTokens,
        mapping(address => uint8) storage tokenDecimals
    ) internal {
        // 先检查是否为合约地址
        require(token.code.length > 0, "Token decimals call failed - not a valid ERC20 token");

        supportedTokens[token] = true;

        try ERC20(token).decimals() returns (uint8 decimals) {
            require(decimals > 0 && decimals <= 18, "Unsupported decimals");
            tokenDecimals[token] = decimals;
        } catch {
            // 安全修复：代币不符合 ERC20 标准时直接回滚，而非使用默认值
            revert("Token decimals call failed - not a valid ERC20 token");
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
            (bool ok, ) = payable(multisigWallet).call{value: amount}("");
            require(ok, "ETH transfer failed");
        } else {
            IERC20 tokenContract = IERC20(token);
            require(tokenContract.balanceOf(address(this)) >= amount, "Insufficient token balance");
            tokenContract.safeTransfer(multisigWallet, amount);
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
            (bool ok, ) = payable(multisigWallet).call{value: ethBalance}("");
            require(ok, "ETH transfer failed");
        }
        
        // 提取所有代币
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20 token = IERC20(tokens[i]);
            uint256 balance = token.balanceOf(address(this));
            if (balance > 0) {
                token.safeTransfer(multisigWallet, balance);
            }
        }
    }
}
