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
    uint256 timestamp;
    uint256 amount;
    address token;
}

/**
 * @notice Structure for storing payment page information
 * @dev Used to track payment records in a paginated manner
 */
struct PaymentPage {
    Payment[] data;
    uint256 total;
}

/**
 * @notice Structure to store minting rate and count for each threshold
 */
struct MintingRateInfo {
    uint256 mintRate; // Minting rate (percentage)
    uint256 mintCount; // Total mint count for this threshold
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
    address public token;

    /// @notice The version identifier of the contract
    /// @dev Used for tracking contract versions during upgrades
    string public constant version = "v1.0";

    /// @notice Mapping of user addresses to their payment history
    /// @dev Each address can have multiple payment records
    mapping(address => Payment[]) public payments;

    /// @notice Mapping of token addresses to their symbols
    /// @dev Used to track which tokens are supported by the vault
    mapping(address _token => string _symbol) public supportCoins;
    /// @notice Record the minting status of the address
    mapping(address => bool) private _minting;

    /// @notice Deposit Funds Allocation Ratio to Multisignature Addresses
    uint256 public constant FUNDING_RATE = 30; // 30%
    /// @notice Minting Rate of LLAX Token
    uint256 public constant MINTING_RATE = 60; // 60%

    /// @notice Total number of minting transactions (deprecated, kept for storage compatibility)
    uint256 public totalMintCount;

    /// @notice Mapping to store minting rate thresholds (deprecated, kept for storage compatibility)
    mapping(uint256 => MintingRateInfo) public mintingRateThresholds;

    // Events
    /// @notice Emitted when a withdrawal is executed
    /// @param to The recipient address
    /// @param when The timestamp of the withdrawal
    /// @param amount The amount withdrawn
    /// @param token The token address
    event Withdrawal(
        address indexed to,
        uint256 when,
        uint256 amount,
        address indexed token
    );

    /// @notice Emitted when tokens are deposited
    /// @param sender The depositor's address
    /// @param when The timestamp of the deposit
    /// @param amount The amount deposited
    /// @param token The token address
    event Deposit(
        address indexed sender,
        uint256 when,
        uint256 amount,
        address indexed token
    );

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
    /// @param when The timestamp of the deposit
    /// @param amount The deposited amount
    /// @param token The token address
    event PaymentDeposited(
        address indexed sender,
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
    event TokenUpdated(address indexed newAddress);

    /// @notice Emitted when the multi-signature wallet address is updated
    /// @param newAddress The new multi-signature wallet address
    event MultiSigUpdated(address indexed newAddress);

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
    error TransferFailed(
        address _token,
        address _from,
        address _to,
        uint256 _amount
    );
    /**
     * @notice Contract initialization
     * @dev Sets up initial contract state and roles
     */

    /// @notice Reentrancy Protection Error in Minting
    error MintingInProgress();
    /// @notice Reentrancy Protection Error in Minting
    error MintingFailed();

    function initialize(
        address _defaultAdmin,
        address _pauser,
        address _minter,
        address _tokenManager,
        address _upgrader,
        address _token,
        address _multiSig
    ) public initializer {
        if (_defaultAdmin == address(0)) revert InvalidAddress(address(0));
        if (_pauser == address(0)) revert InvalidAddress(address(0));
        if (_minter == address(0)) revert InvalidAddress(address(0));
        if (_tokenManager == address(0)) revert InvalidAddress(address(0));
        if (_upgrader == address(0)) revert InvalidAddress(address(0));
        if (_token == address(0)) revert InvalidAddress(address(0));
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

        token = _token;
        multiSig = _multiSig;
        emit TokenUpdated(_token);

        // Initialize default minting rate thresholds
        mintingRateThresholds[1] = MintingRateInfo({mintRate: 50, mintCount: 100});       // 1st tier: 50%, 0-100
        mintingRateThresholds[2] = MintingRateInfo({mintRate: 40, mintCount: 10000});    // 2nd tier: 40%, 101-10000
        mintingRateThresholds[3] = MintingRateInfo({mintRate: 30, mintCount: 100000});   // 3rd tier: 30%, 10001-100000
        mintingRateThresholds[4] = MintingRateInfo({mintRate: 20, mintCount: 1000000});  // 4th tier: 20%, 100001-1000000
        mintingRateThresholds[5] = MintingRateInfo({mintRate: 10, mintCount: type(uint256).max}); // 5th tier: 10%, >1000000
    }

    /**
     * @notice Updates the token address
     * @param _newToken New token address to be set
     */
    function updateToken(
        address _newToken
    ) external onlyRole(TOKEN_MANAGER_ROLE) {
        if (_newToken == address(0)) revert InvalidAddress(address(0));
        token = _newToken;
        emit TokenUpdated(_newToken);
    }

    function updateMultiSig(
        address _newMultiSig
    ) external onlyRole(ADMIN_ROLE) {
        if (_newMultiSig == address(0)) revert InvalidAddress(address(0));
        multiSig = _newMultiSig;
        emit MultiSigUpdated(_newMultiSig);
    }

    /**
     * @notice Updates the minting rate threshold
     * @dev Can only be called by the admin
     * @param tier The tier key (1, 2, 3, 4, 5)
     * @param rate The minting rate (percentage)
     * @param count The mint count threshold for this tier
     */
    function updateMintingRateThreshold(
        uint256 tier,
        uint256 rate,
        uint256 count
    ) external onlyRole(ADMIN_ROLE) {
        if (rate > 100) revert InvalidAmount(rate); // Ensure rate is a valid percentage
        if (tier == 0 || tier > 5) revert InvalidAmount(tier); // Ensure tier is valid
        mintingRateThresholds[tier] = MintingRateInfo({mintRate: rate, mintCount: count});
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
        if (token == address(0)) revert InvalidAddress(address(0));
        if (multiSig == address(0)) revert InvalidAddress(address(0));
        if (_amount <= 0) revert InvalidAmount(_amount);
        if (_minting[msg.sender]) revert MintingInProgress();
        _minting[msg.sender] = true;

        // Effects before interactions
        payments[msg.sender].push(
            Payment({
                payer: msg.sender,
                timestamp: block.timestamp,
                amount: _amount,
                token: _token
            })
        );

        IERC20 myToken = IERC20(_token);
        uint256 sendAmountToMultisig = (_amount * FUNDING_RATE) / 100;
        uint256 sendAmountToSelf = _amount - sendAmountToMultisig;

        // External interactions
        myToken.safeTransferFrom(msg.sender, multiSig, sendAmountToMultisig);
        myToken.safeTransferFrom(msg.sender, address(this), sendAmountToSelf);
        emit PaymentDeposited(msg.sender, block.timestamp, _amount, _token);

        // Calculate MINTING_RATE based on totalMintCount
        uint256 mintingRate = getMintingRate();

        // Mint LLA tokens to the user
        uint256 mintAmount = (_amount * mintingRate + 50) / 100;
        try IERC20Mintable(token).mint(msg.sender, mintAmount) {
            emit MintToAddress(msg.sender, mintAmount);
            totalMintCount++; // Increment total mint count
        } catch {
            _minting[msg.sender] = false;
            revert MintingFailed();
        }

        // Reset the minting state
        _minting[msg.sender] = false;
    }

    /**
     * @notice Determines the minting rate based on the total number of minting transactions
     * @return The minting rate as a percentage
     */
    function getMintingRate() public view returns (uint256) {
        for (uint256 tier = 1; tier <= 5; tier++) {
            if (totalMintCount <= mintingRateThresholds[tier].mintCount) {
                return mintingRateThresholds[tier].mintRate;
            }
        }
        return 0; // Default to 0 if no tier matches
    }

    /**
     * @notice Adds a new supported token
     * @param _token Address of token to add
     */
    function addSupportedToken(
        address _token
    ) public onlyRole(TOKEN_MANAGER_ROLE) whenNotPaused {
        if (!isEmpty(supportCoins[_token]))
            revert AlreadyInTheSupportedIcon(_token);
        if (_token == address(0)) revert InvalidAddress(_token);

        ERC20 myToken = ERC20(_token);
        string memory _symbol = myToken.symbol();
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

    /**
     * @notice Obtain the total number of user payment records.
     * @param _user The user address
     */
    function getPaymentCount(address _user) public view returns (uint256) {
        return payments[_user].length;
    }

    /**
     * @notice Obtain the payment record of a user by index.
     * @param _page The page number
     * @param _size The number of records per page
     * @param _user The user address
     */
    function getPaymentsByPage(
        uint256 _page,
        uint256 _size,
        address _user
    ) public view returns (PaymentPage memory) {
        uint256 total = payments[_user].length;

        // If the page number is 0, automatically adjust it to page 1.
        if (_page == 0) {
            _page = 1;
        }

        // Calculate the starting index.
        uint256 startIndex = (_page - 1) * _size;

        // If the starting index is out of range, return an empty array.
        if (startIndex >= total) {
            Payment[] memory emptyData = new Payment[](0);
            return PaymentPage({data: emptyData, total: total});
        }

        // Calculate the actual number of records to be returned (which may be less than `_size`).
        uint256 actualSize = _size;
        if (startIndex + actualSize > total) {
            actualSize = total - startIndex;
        }

        // Create the result array.

        Payment[] memory result = new Payment[](actualSize);

        // Populate the result array.
        for (uint256 i = 0; i < actualSize; i++) {
            result[i] = payments[_user][startIndex + i];
        }

        return PaymentPage({data: result, total: total});
    }

    /**
     * @notice Sets the total mint count (for testing purposes only)
     * @dev This function is intended for testing and debugging purposes only.
     *      It should not be used in production environments.
     *      Ensure this function is disabled or removed in production deployments.
     * @param count The new total mint count
     */
    function setTotalMintCount(uint256 count) external onlyRole(ADMIN_ROLE) {
        totalMintCount = count;
    }
}

/**@notice Interface for ERC20 tokens with minting capability
 */
interface IERC20Mintable {
    event Minting(address indexed to, uint256 amount);
    function mint(address to, uint256 amount) external;
}