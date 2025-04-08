// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.28;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20BurnableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import {ERC20PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title LLAX Token Contract
 * @author Jason Chen
 * @notice This contract implements the LLA token with role-based access control
 * @dev Extends multiple OpenZeppelin contracts for upgradeability and functionality
 */
contract LLAXToken is
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    ERC20PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    /// @notice Role identifier for administrative actions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    /// @notice Role identifier for pause/unpause functionality
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    /// @notice Role identifier for minting tokens
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    /// @notice Role identifier for contract upgrades
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    /// @notice Current version of the contract
    string public constant version = "v1.0";
    // @notice Total supply of LLA tokens
    uint256 public constant TOTAL_SUPPLY = 100_0000_0000 * 1e18;

    /// @notice Error thrown when an invalid address is provided
    /// @param addr The invalid address that was provided
    error InvalidAddress(address addr);

    /// @notice Error thrown when an invalid amount is provided
    /// @param amount The invalid amount that was provided
    error InvalidAmount(uint amount);

    /**
     * @notice Initializes the contract with required roles
     * @dev Sets up initial token parameters and assigns roles
     * @param defaultAdmin Address to be granted admin role
     * @param pauser Address to be granted pauser role
     * @param minter Address to be granted minter role
     * @param upgrader Address to be granted upgrader role
     */
    function initialize(
        address defaultAdmin,
        address pauser,
        address minter,
        address upgrader
    ) public initializer {
        if (defaultAdmin == address(0)) revert InvalidAddress(defaultAdmin);
        if (pauser == address(0)) revert InvalidAddress(pauser);
        if (minter == address(0)) revert InvalidAddress(minter);
        if (upgrader == address(0)) revert InvalidAddress(upgrader);

        __ERC20_init("LLAX", "LLAX");
        __ERC20Burnable_init();
        __ERC20Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(ADMIN_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(UPGRADER_ROLE, upgrader);
    }

    /**
     * @notice Pauses all token transfers
     * @dev Can only be called by accounts with PAUSER_ROLE
     */
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses all token transfers
     * @dev Can only be called by accounts with PAUSER_ROLE
     */
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Creates new tokens and assigns them to an address
     * @dev Can only be called by accounts with MINTER_ROLE
     * @param to Address to receive the minted tokens
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        if(amount == 0) revert InvalidAmount(amount);
        if(to == address(0)) revert InvalidAddress(to);
        _mint(to, amount);
    }

    /**
     * @notice Burns tokens from the caller's account
     * @dev Overrides the standard burn function with amount validation
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) public override {
        if(amount == 0) revert InvalidAmount(amount);
        _burn(msg.sender, amount);
    }

    /**
     * @notice Authorizes an upgrade to a new implementation
     * @dev Can only be called by accounts with UPGRADER_ROLE
     * @param _newImplementation Address of the new implementation contract
     */
    function _authorizeUpgrade(
        address _newImplementation
    ) internal view override onlyRole(UPGRADER_ROLE) {
        if (_newImplementation == address(0)) {
            revert InvalidAddress(_newImplementation);
        }
    }

    /**
     * @notice Updates token balances for transfers
     * @dev Internal function to handle token transfers while respecting pause state
     * @param from Address tokens are transferred from
     * @param to Address tokens are transferred to
     * @param value Amount of tokens transferred
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20Upgradeable, ERC20PausableUpgradeable) {
        super._update(from, to, value);
    }

    /**
     * @notice Grants a role to an account
     * @dev Can only be called by accounts with ADMIN_ROLE
     * @param role The role identifier to grant
     * @param account The address to grant the role to
     */
    function addRole(
        bytes32 role,
        address account
    ) external onlyRole(ADMIN_ROLE) {
        _grantRole(role, account);
    }

    /**
     * @notice Revokes a role from an account
     * @dev Can only be called by accounts with ADMIN_ROLE
     * @param role The role identifier to revoke
     * @param account The address to revoke the role from
     */
    function revokeRole(
        bytes32 role,
        address account
    ) public override onlyRole(ADMIN_ROLE) {
        _revokeRole(role, account);
    }


    /**
     * 
     * @param spender address
     * @param amount amount
     */
    function approve(address spender, uint256 amount) public override whenNotPaused returns (bool) {
        return super.approve(spender, amount);
    }
}