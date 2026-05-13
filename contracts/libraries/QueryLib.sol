// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PurchaseRecord} from "./PurchaseLib.sol";

library QueryLib {
    error InvalidPagination();

    function getPaginatedRecords(
        PurchaseRecord[] storage records,
        uint256[] memory purchaseIds,
        uint256 page,
        uint256 pageSize
    ) internal view returns (PurchaseRecord[] memory) {
        if (page == 0 || pageSize == 0 || pageSize > 50 || page > 1000) revert InvalidPagination();

        uint256 totalMatches = purchaseIds.length;
        if (totalMatches == 0) return new PurchaseRecord[](0);

        uint256 start = (page - 1) * pageSize;
        if (start >= totalMatches) return new PurchaseRecord[](0);

        uint256 end = start + pageSize > totalMatches ? totalMatches : start + pageSize;
        PurchaseRecord[] memory result = new PurchaseRecord[](end - start);

        for (uint256 i = start; i < end; i++) {
            result[i - start] = records[purchaseIds[i]];
        }

        return result;
    }

    function validatePagination(uint256 offset, uint256 limit) internal pure {
        if (limit == 0 || limit > 50 || offset >= 10000) revert InvalidPagination();
    }

    function calculatePagination(uint256 totalLength, uint256 offset, uint256 limit) internal pure returns (uint256 actualLimit, bool hasResults) {
        if (offset >= totalLength) return (0, false);
        actualLimit = offset + limit > totalLength ? totalLength - offset : limit;
        return (actualLimit, true);
    }
}