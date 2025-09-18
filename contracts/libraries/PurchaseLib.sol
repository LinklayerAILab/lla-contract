// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ProductItem} from "./ProductLib.sol";

struct PurchaseRecord {
    string orderId; // 订单id
    address buyer;
    uint256 productId;
    uint256 amount;
    string userId;  // Telegram userId 为字符串格式，如 "6543877705"
    uint256 timestamp;
    string symbol;
}

library PurchaseLib {
    using SafeERC20 for IERC20;
    
    
    function executePayment(
        address payToken,
        address from,
        address to,
        uint256 amount
    ) internal {
        IERC20(payToken).safeTransferFrom(from, to, amount);
    }
    
    function getTokenSymbol(address token) internal view returns (string memory) {
        try ERC20(token).symbol() returns (string memory s) {
            return s;
        } catch {
            return "TOKEN";
        }
    }
    
    function createPurchaseRecord(
        address buyer,
        string memory orderId,
        uint256 productId,
        uint256 amount,
        string memory userId,
        string memory symbol
    ) internal view returns (PurchaseRecord memory) {
        return PurchaseRecord({
            buyer: buyer,
            orderId: orderId,
            productId: productId,
            amount: amount,
            userId: userId,
            timestamp: block.timestamp,
            symbol: symbol
        });
    }
    
    function createEmptyRecord() internal pure returns (PurchaseRecord memory) {
        return PurchaseRecord({
            orderId: "",
            buyer: address(0),
            productId: 0,
            amount: 0,
            userId: "",
            timestamp: 0,
            symbol: ""
        });
    }
}