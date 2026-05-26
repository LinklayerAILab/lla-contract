// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.6.0
pragma solidity ^0.8.27;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract LLAx is ERC20, ERC20Pausable, AccessControl, ERC20Permit {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 public constant MAX_SUPPLY = 100_000_000_000 * 1e18;

    event Burned(address indexed burner, uint256 amount);

    constructor(address defaultAdmin, address pauser)
        ERC20("LLAx", "LLAx")
        ERC20Permit("LLAx")
    {
        require(defaultAdmin != address(0), "LLAx: admin is zero address");
        require(pauser != address(0), "LLAx: pauser is zero address");

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, pauser);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(totalSupply() + amount <= MAX_SUPPLY, "LLAx: exceeds max supply");
        _mint(to, amount);
    }

    function burn(uint256 amount) public {
        require(amount > 0, "LLAx: amount is zero");
        _burn(msg.sender, amount);
        emit Burned(msg.sender, amount);
    }

    function burnFrom(address account, uint256 amount) public {
        require(amount > 0, "LLAx: amount is zero");
        _spendAllowance(account, msg.sender, amount);
        _burn(account, amount);
        emit Burned(account, amount);
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        if (paused()) {
            // Allow burns even when paused
            if (!(from != address(0) && to == address(0))) {
                revert EnforcedPause();
            }
        }
        ERC20._update(from, to, value);
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
