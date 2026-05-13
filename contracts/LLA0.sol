// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.5.0
pragma solidity ^0.8.27;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract LLA0 is ERC20, ERC20Pausable, AccessControl, ERC20Permit {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 public constant MAX_SUPPLY = 625_000_000 * 10 ** 18; // 6.25 亿枚代币上限

    // Events
    event Minted(address indexed minter, address indexed to, uint256 amount);

    constructor(address defaultAdmin, address pauser, address minter)
        ERC20("LLA0", "LA0")
        ERC20Permit("LLA0")
    {
        require(defaultAdmin != address(0), "LLA0: admin is zero address");
        require(pauser != address(0), "LLA0: pauser is zero address");
        require(minter != address(0), "LLA0: minter is zero address");

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(MINTER_ROLE, minter);
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        require(to != address(0), "LLA0: mint to zero address");
        require(amount > 0, "LLA0: amount is zero");

        uint256 newSupply = totalSupply() + amount;
        require(newSupply <= MAX_SUPPLY, "LLA0: exceeds max supply");

        _mint(to, amount);
        emit Minted(msg.sender, to, amount);
    }

    /**
     * @notice Allows anyone to burn their own tokens
     * @param amount The amount of tokens to burn
     */
    function burn(uint256 amount) public {
        require(amount > 0, "LLA0: amount is zero");
        _burn(msg.sender, amount);
    }

    // The following functions are overrides required by Solidity.

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}