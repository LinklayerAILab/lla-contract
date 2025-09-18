// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

library ValidationLib {
    function isValidTelegramUserId(string memory userId) internal pure returns (bool) {
        bytes memory userIdBytes = bytes(userId);
        uint256 length = userIdBytes.length;
        
        if (length == 0 || length > 20) return false;
        
        for (uint256 i = 0; i < length;) {
            if (userIdBytes[i] < 0x30 || userIdBytes[i] > 0x39) return false;
            unchecked { ++i; }
        }
        
        return true;
    }
    
    function validateAddress(address addr) internal pure {
        require(addr != address(0));
    }
    
    function validateString(string memory str) internal pure {
        require(bytes(str).length > 0);
    }
}