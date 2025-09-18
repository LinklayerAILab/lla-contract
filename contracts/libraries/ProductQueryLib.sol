// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ProductItem} from "./ProductLib.sol";

library ProductQueryLib {
    
    /**
     * 获取所有商品列表（优化版本）
     */
    function getProductList(
        ProductItem[] storage productList,
        mapping(uint256 => ProductItem) storage productIdToItem,
        mapping(uint256 => bool) storage productExists,
        uint256 activeProductCount
    ) internal view returns (ProductItem[] memory) {
        uint256 arrayLength = productList.length;
        uint256 realCount = activeProductCount;
        
        // 检查数据一致性
        if (arrayLength == realCount && arrayLength > 0) {
            // 数据一致，直接使用数组（高效）
            uint256 returnCount = arrayLength > 50 ? 50 : arrayLength;
            ProductItem[] memory result = new ProductItem[](returnCount);
            for (uint256 i = 0; i < returnCount; i++) {
                result[i] = productList[i];
            }
            return result;
        }
        
        // 数据不一致或为空，使用映射重建（但限制搜索范围）
        if (realCount == 0) {
            return new ProductItem[](0);
        }
        
        uint256 mappingReturnCount = realCount > 50 ? 50 : realCount;
        ProductItem[] memory mappingResult = new ProductItem[](mappingReturnCount);
        uint256 resultIndex = 0;
        uint256 maxSearchRange = 1000; // 限制搜索范围为1000，防止DoS
        
        for (uint256 i = 1; i <= maxSearchRange && resultIndex < mappingReturnCount; i++) {
            if (productExists[i]) {
                ProductItem memory item = productIdToItem[i];
                if (item.productId != 0) {
                    mappingResult[resultIndex] = item;
                    resultIndex++;
                }
            }
        }
        
        return mappingResult;
    }
    
    /**
     * 分页获取商品列表
     */
    function getProductListPaginated(
        ProductItem[] storage productList,
        uint256 offset, 
        uint256 limit
    ) internal view returns (ProductItem[] memory) {
        uint256 length = productList.length;
        
        require(limit > 0);
        if (limit > 50) limit = 50;
        require(offset < 10000);
        
        // 检查offset是否超出范围
        if (offset >= length || length == 0) {
            return new ProductItem[](0);
        }
        
        // 计算实际返回数量，防止整数溢出
        uint256 remaining = length - offset;
        uint256 actualLimit = remaining < limit ? remaining : limit;
        
        require(offset + actualLimit <= length);
        
        ProductItem[] memory result = new ProductItem[](actualLimit);
        for (uint256 i = 0; i < actualLimit; i++) {
            result[i] = productList[offset + i];
        }
        
        return result;
    }
    
}