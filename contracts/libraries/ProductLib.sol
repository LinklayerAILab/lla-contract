// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

struct ProductItem {
    uint256 productId;
    uint256 amount;
}

library ProductLib {
    function validateProductId(uint256 productId) internal pure {
        require(productId != 0);
    }
    
    function validateAmount(uint256 amount) internal pure {
        require(amount != 0);
    }
    
    function findProductIndex(ProductItem[] storage products, uint256 productId) internal view returns (uint256, bool) {
        uint256 len = products.length;
        for (uint256 i = 0; i < len;) {
            if (products[i].productId == productId) {
                return (i, true);
            }
            unchecked { ++i; }
        }
        return (0, false);
    }
    

}