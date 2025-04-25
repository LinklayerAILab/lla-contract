// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.28;
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract LLAVaultAuth is AccessControlUpgradeable,UUPSUpgradeable {
    // PAUSER_ROLE
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    // PAUSER_ROLE
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    // UPGRADER_ROLE
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    // TOKEN_MANAGER_ROLE
    bytes32 public constant TOKEN_MANAGER_ROLE = keccak256("TOKEN_MANAGER_ROLE");
    // TOKEN_WITHDRAW_ROLE
    bytes32 public constant TOKEN_WITHDRAW_ROLE = keccak256("TOKEN_WITHDRAW_ROLE");
    error InvalidImplementationAddress(address newImplementation);

    // Initialization function
    function initializeAuth(
        address defaultAdmin,
        address pauser,
        address tokenManager,
        address upgrader,
        address tokenWithdraw
    ) public initializer {
        __AccessControl_init();
        _grantRole(ADMIN_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(UPGRADER_ROLE, upgrader);
        _grantRole(TOKEN_MANAGER_ROLE, tokenManager);
        _grantRole(TOKEN_WITHDRAW_ROLE, tokenWithdraw);
    }
    /**
     *  @notice dynamically add roles through multi-signature contract addresses
     *  @param role       role
     *  @param account    the address corresponding to the role
     */
    function addRole(bytes32 role, address account) external onlyRole(ADMIN_ROLE) {
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

    /**
     * @dev Updates the implementation of the contract.
     * @param _newImplementation The address of the new implementation contract.
     */
    function _authorizeUpgrade(
        address _newImplementation
    ) internal view override onlyRole(UPGRADER_ROLE) {
       if(_newImplementation == address(0)){
         revert InvalidImplementationAddress(_newImplementation);
       }
    }
}