// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {PurchaseLib} from "./PurchaseLib.sol";

library DecimalConversionLib {
    uint8 public constant BASE_DECIMALS = 18;

    /**
     * 根据代币精度转换产品价格
     * @param baseAmount 基准价格 (产品存储的原始价格，假设为18位精度)
     * @param tokenDecimal 代币精度
     * @return 转换后的实际支付金额
     */
    function convertPriceForToken(uint256 baseAmount, uint8 tokenDecimal) internal pure returns (uint256) {
        require(tokenDecimal > 0, "Token not supported or decimals not set");
        
        // 如果代币精度等于基准精度，直接返回
        if (tokenDecimal == BASE_DECIMALS) {
            return baseAmount;
        }
        
        // 如果代币精度小于基准精度，需要缩小金额
        if (tokenDecimal < BASE_DECIMALS) {
            uint8 decimalDiff = BASE_DECIMALS - tokenDecimal;
            return baseAmount / (10 ** decimalDiff);
        }
        
        // 如果代币精度大于基准精度，需要放大金额（这种情况不应该出现，因为限制最大18位）
        // 但为了完整性保留此逻辑
        uint8 expandDiff = tokenDecimal - BASE_DECIMALS;
        return baseAmount * (10 ** expandDiff);
    }

    /**
     * 获取代币的实际支付金额（用于前端展示）
     * @param baseAmount 基准金额
     * @param token 支付代币地址
     * @param tokenDecimal 代币精度
     * @return actualAmount 实际需要支付的代币数量
     * @return tokenSymbol 代币符号
     * @return tokenDecimalCount 代币精度
     */
    function getPaymentInfo(
        uint256 baseAmount, 
        address token,
        uint8 tokenDecimal
    ) internal view returns (uint256 actualAmount, string memory tokenSymbol, uint8 tokenDecimalCount) {
        actualAmount = convertPriceForToken(baseAmount, tokenDecimal);
        tokenSymbol = PurchaseLib.getTokenSymbol(token);
        tokenDecimalCount = tokenDecimal;
        
        return (actualAmount, tokenSymbol, tokenDecimalCount);
    }

    /**
     * 批量获取代币精度信息
     * @param tokens 代币地址数组
     * @return decimals 精度数组
     */
    function batchGetTokenDecimals(address[] calldata tokens) 
        internal view returns (uint8[] memory decimals) 
    {
        decimals = new uint8[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            try ERC20(tokens[i]).decimals() returns (uint8 d) {
                require(d <= 18, "Unsupported decimals");
                decimals[i] = d;
            } catch {
                decimals[i] = 0; // 标记为无效
            }
        }
        return decimals;
    }
}