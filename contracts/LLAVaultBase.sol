// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.28;

/**
 * @title LLA Vault Contract
 * @author Jason Chen
 * @notice Main vault contract for managing token deposits and withdrawals
 * @dev Created on 2025/3/3
 */
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {LLAVaultAuth} from "./LLAVaultAuth.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
/**
 * @notice Structure for storing payment information
 * @dev Used to track all payment transactions in the vault
 */
struct Payment {
    address payer;
    address to;
    uint256 timestamp;
    uint256 amount;
    address token;
}

contract LLAVaultBase is
    Initializable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    LLAVaultAuth
{
    using SafeERC20 for IERC20;
    // State Variables
    /// @notice The multi-signature wallet address used for administrative operations
    /// @dev This address has special permissions for withdrawals and critical operations
    address public multiSig;

    /// @notice The address of the LLA token contract
    /// @dev Used for minting LLA tokens when users deposit other tokens
    address public llaToken;

    /// @notice The version identifier of the contract
    /// @dev Used for tracking contract versions during upgrades
    string public constant version = "v1.0";

    /// @notice Mapping of user addresses to their payment history
    /// @dev Each address can have multiple payment records
    mapping(address => Payment[]) public payments;

    /// @notice Mapping of token addresses to their symbols
    /// @dev Used to track which tokens are supported by the vault
    mapping(address _token => string _symbol) public supportCoins;


    // Events
    /// @notice Emitted when a withdrawal is executed
    /// @param to The recipient address
    /// @param when The timestamp of the withdrawal
    /// @param amount The amount withdrawn
    /// @param token The token address
    event Withdrawal(address indexed to, uint256 when, uint256 amount, address indexed token);

    /// @notice Emitted when tokens are deposited
    /// @param sender The depositor's address
    /// @param when The timestamp of the deposit
    /// @param amount The amount deposited
    /// @param token The token address
    event Deposit(address indexed sender, uint256 when, uint256 amount, address indexed token);

    /// @notice Emitted when a new token is added to supported tokens list
    /// @param token The address of the newly supported token
    /// @param symbol The symbol of the token
    event TokenAdded(address indexed token, string symbol);

    /// @notice Emitted when a token is removed from supported tokens list
    /// @param token The address of the removed token
    /// @param symbol The symbol of the removed token
    event TokenRemoved(address indexed token, string symbol);

    /// @notice Emitted when a payment is deposited into the vault
    /// @param sender The depositor's address
    /// @param to The recipient address (usually the vault)
    /// @param when The timestamp of the deposit
    /// @param amount The deposited amount
    /// @param token The token address
    event PaymentDeposited(
        address indexed sender,
        address indexed to,
        uint256 when,
        uint256 indexed amount,
        address token
    );

    /// @notice Emitted when LLA tokens are minted to an address
    /// @param to The recipient of the minted tokens
    /// @param amount The amount of tokens minted
    event MintToAddress(address indexed to, uint256 amount);

    /// @notice Emitted when the LLA token address is updated
    /// @param newAddress The new LLA token address
    event LLATokenUpdated(address indexed newAddress);

    // Custom Errors
    /// @notice Thrown when an invalid amount is provided
    /// @param _amount The invalid amount
    error InvalidAmount(uint256 _amount);

    /// @notice Thrown when an invalid address is provided
    /// @param _address The invalid address
    error InvalidAddress(address _address);

    /// @notice Thrown when multisig verification fails
    /// @param _address The invalid multisig address
    error InvalidMultisigAddress(address _address);

    /// @notice Thrown when attempting to use an unsupported token
    /// @param _token The unsupported token address
    error UnsupportedToken(address _token);

    /// @notice Thrown when attempting to add an already supported token
    /// @param _token The token address that is already supported
    error AlreadyInTheSupportedIcon(address _token);

    /// @notice Thrown when a token transfer fails
    /// @param _token The token address
    /// @param _from The sender address
    /// @param _to The recipient address
    /// @param _amount The transfer amount
    error TransferFailed(address _token, address _from, address _to, uint256 _amount);
    /**
     * @notice Contract initialization
     * @dev Sets up initial contract state and roles
     */
    function initialize(
        address _defaultAdmin,
        address _pauser,
        address _minter,
        address _tokenManager,
        address _upgrader,
        address _llaToken,
        address _multiSig
    ) public initializer {
        if (_defaultAdmin == address(0)) revert InvalidAddress(address(0));
        if (_pauser == address(0)) revert InvalidAddress(address(0));
        if (_minter == address(0)) revert InvalidAddress(address(0));
        if (_tokenManager == address(0)) revert InvalidAddress(address(0));
        if (_upgrader == address(0)) revert InvalidAddress(address(0));
        if (_llaToken == address(0)) revert InvalidAddress(address(0));
        if (_multiSig == address(0)) revert InvalidAddress(address(0));

        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        super.initializeAuth(
            _defaultAdmin,
            _pauser,
            _minter,
            _tokenManager,
            _upgrader
        );

        llaToken = _llaToken;
        multiSig = _multiSig;
        emit LLATokenUpdated(_llaToken);
    }

    /**
     * @notice Updates the LLA token address
     * @param _newLLAToken New token address to be set
     */
    function updateLLAToken(
        address _newLLAToken
    ) external onlyRole(TOKEN_MANAGER_ROLE) {
        if (_newLLAToken == address(0)) revert InvalidAddress(address(0));
        llaToken = _newLLAToken;
        emit LLATokenUpdated(_newLLAToken);
    }

    /**
     * @notice Pauses contract operations
     */
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Resumes contract operations
     */
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Deposits tokens into the vault
     * @param _token Token address to deposit
     * @param _amount Amount of tokens to deposit
     */
    function deposit(
        address _token,
        uint256 _amount
    ) public payable whenNotPaused nonReentrant {
        if (isEmpty(supportCoins[_token])) revert UnsupportedToken(_token);
        if (llaToken == address(0)) revert InvalidAddress(address(0));
        if (multiSig == address(0)) revert InvalidAddress(address(0));
        if (_amount <= 0) revert InvalidAmount(_amount);

        // Effects before interactions
        payments[msg.sender].push(
            Payment({
                payer: msg.sender,
                to: address(this),
                timestamp: block.timestamp,
                amount: _amount,
                token: _token
            })
        );
        IERC20 token = IERC20(_token);
        // External interactions
        token.safeTransferFrom(msg.sender, multiSig, _amount);
        emit PaymentDeposited(msg.sender, multiSig, block.timestamp, _amount, _token);
        IERC20Mintable(llaToken).mint(msg.sender, _amount * 1e18);
    }

    /**
     * @notice Adds a new supported token
     * @param _token Address of token to add
     */
    function addSupportedToken(
        address _token
    ) public onlyRole(TOKEN_MANAGER_ROLE) whenNotPaused {
        if (!isEmpty(supportCoins[_token])) revert AlreadyInTheSupportedIcon(_token);
        if (_token == address(0)) revert InvalidAddress(_token);
        
        ERC20 token = ERC20(_token);
        string memory _symbol = token.symbol();
        supportCoins[_token] = _symbol;
        emit TokenAdded(_token, _symbol);
    }

    /**
     * @notice Removes a supported token
     * @param _token Address of token to remove
     */
    function removeSupportedToken(
        address _token
    ) public onlyRole(TOKEN_MANAGER_ROLE) whenNotPaused {
        string memory _symbol = supportCoins[_token];
        if (isEmpty(_symbol)) revert UnsupportedToken(_token);
        
        supportCoins[_token] = "";
        emit TokenRemoved(_token, _symbol);
    }

    /**
     * @notice Checks if a string is empty
     * @param str String to check
     * @return bool True if string is empty
     */
    function isEmpty(string memory str) public pure returns (bool) {
        return bytes(str).length == 0;
    }
}

/**
 * @notice Interface for ERC20 tokens with minting capability
 */
interface IERC20Mintable {
    function mint(address to, uint256 amount) external;
}