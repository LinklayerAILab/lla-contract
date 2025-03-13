// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.28;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20BurnableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import {ERC20PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract NewLLAToken is
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    ERC20PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    string public constant version = "v2.0";
    error InvalidAddress(address addr);

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

        __ERC20_init("LLA", "LLA");
        __ERC20Burnable_init();
        __ERC20Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(ADMIN_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(UPGRADER_ROLE, upgrader);
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function burn(uint256 amount) public override {
        _burn(msg.sender, amount);
    }

    /**
     * update the implementation of the contract
     * @param _newImplementation The address of the new implementation contract.
     */
    function _authorizeUpgrade(
        address _newImplementation
    ) internal view override onlyRole(UPGRADER_ROLE) {
        if (_newImplementation == address(0)) {
            revert InvalidAddress(_newImplementation);
        }
    }

    // The following functions are overrides required by Solidity.

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20Upgradeable, ERC20PausableUpgradeable) {
        super._update(from, to, value);
    }

    /**
     *  @notice dynamically add roles through multi-signature contract addresses
     *  @param role       role
     *  @param account    the address corresponding to the role
     */
    function addRole(
        bytes32 role,
        address account
    ) external onlyRole(ADMIN_ROLE) {
        _grantRole(role, account);
    }

    /**
     *  @notice cancel the authorization to assign a role to a certain address through the multi-signature contract address
     *  @param role       role
     *  @param account    deauthorized  address
     */
    function revokeRole(
        bytes32 role,
        address account
    ) public override onlyRole(ADMIN_ROLE) {
        _revokeRole(role, account);
    }
}
