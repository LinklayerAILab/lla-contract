// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PurchaseRecord} from "./PurchaseLib.sol";

library QueryLib {
    
    function getPaginatedRecords(
        PurchaseRecord[] storage records,
        uint256[] memory purchaseIds,
        uint256 page,
        uint256 pageSize
    ) internal view returns (PurchaseRecord[] memory) {
        require(page > 0 && pageSize > 0);
        require(pageSize <= 50);
        require(page <= 1000);
        
        uint256 totalMatches = purchaseIds.length;
        if (totalMatches == 0) {
            return new PurchaseRecord[](0);
        }
        
        uint256 start = (page - 1) * pageSize;
        if (start >= totalMatches) {
            return new PurchaseRecord[](0);
        }

        uint256 end = start + pageSize;
        if (end > totalMatches) {
            end = totalMatches;
        }

        PurchaseRecord[] memory result = new PurchaseRecord[](end - start);
        for (uint256 i = start; i < end; i++) {
            require(i < purchaseIds.length);
            uint256 purchaseId = purchaseIds[i];
            require(purchaseId < records.length);
            result[i - start] = records[purchaseId];
        }
        
        return result;
    }
    
    function validatePagination(uint256 offset, uint256 limit) internal pure {
        require(limit > 0 && limit <= 50);
        require(offset < 10000);
    }
    
    function calculatePagination(
        uint256 totalLength,
        uint256 offset,
        uint256 limit
    ) internal pure returns (uint256 actualLimit, bool hasResults) {
        if (offset >= totalLength) {
            return (0, false);
        }
        
        actualLimit = (offset + limit > totalLength) ? totalLength - offset : limit;
        return (actualLimit, true);
    }
}