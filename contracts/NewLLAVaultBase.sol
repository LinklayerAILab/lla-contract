// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.28;

/**
 * LLA Vault Contract
 * Jason Chen
 * 2025/3/3
 */
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {LLAVaultAuth} from "./LLAVaultAuth.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
// Payment Record
struct Payment {
    address payer;
    uint256 timestamp;
    uint256 amount;
    address token;
    bool isWithdrawn;
}

contract NewLLAVaultBase is
    Initializable,
    PausableUpgradeable,
    UUPSUpgradeable,
    LLAVaultAuth
{
    address public multiSig;
    // LLA ERC20 Token
    address public llaToken;

    string public constant version = "v1.1";

    /**
     * @notice
     */
    mapping(address => Payment[]) public payments;

    /**
     * Supported Currencies
     * @notice
     */
    mapping(address _token => string _symbol) public supportCoins;

    /**
     * Withdrawal Event
     * @param sender The address of the sender.
     * @param when The timestamp of the transaction.
     * @param amount The amount of tokens involved in the transaction.
     * @param token The address of the token contract.
     */
    event Withdrawal(address sender, uint when, uint amount, address token);

    /**
     * Deposit Event
     * @param sender The address of the sender.
     * @param when The timestamp of the transaction.
     * @param amount The amount of tokens involved in the transaction.
     * @param token The address of the token contract.
     */
    event Deposit(address sender, uint when, uint amount, address token);

    /**
     * Add cryptocurrency event
     * @param token The address of the token to be used in the vault.
     * @param symbol The symbol representing the token.
     */

    event TokenAdded(address token, string symbol);

    /**
     * Remove cryptocurrency event
     * @param token The address of the token to be used in the vault.
     * @param symbol The symbol representing the token.
     */
    event TokenRemoved(address token, string symbol);

    /**
     * @param sender The address of the sender.
     * @param when The timestamp of the transaction.
     * @param amount The amount of tokens involved in the transaction.
     * @param token The address of the token contract.
     */
    event PaymentDeposited(
        address sender,
        uint when,
        uint amount,
        address token
    );

    /**
     * Mint tokens to a specific address
     * @param _to The address to mint tokens to
     * @param _amount The amount of tokens to mint
     */
    event MintToAddress(address _to, uint256 _amount);

    /**
     * @param newAddress The new address to be set.
     */
    event LLATokenUpdated(address indexed newAddress);

    error InvalidAmount(uint256 _amount);
    error InvalidAddress(address _address);
    error InvalidMultisigAddress(address _address);
    error UnsupportedToken(address _token);
    error AlreadyInTheSupportedIcon(address _token);


    /**
     * @param _token The token address involved in the failed transfer
     * @param _from The sender address of the failed transfer
     * @param _to The recipient address of the failed transfer
     * @param _amount The amount that failed to transfer
     */
    error TransferFailed(
        address _token,
        address _from,
        address _to,
        uint256 _amount
    );

    /**
     * Initialization function
     * @param _defaultAdmin The address of the default admin.
     * @param _pauser The address of the account that can pause the contract.
     * @param _minter The address of the account that can mint tokens.
     * @param _tokenManager The address of the account that manages tokens.
     * @param _upgrader The address of the account that can upgrade the contract.
     * @param _llaToken Address of the LLA token contract.
     * @param _multiSig Address of the multi-signature wallet.
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
        __UUPSUpgradeable_init();
        __Pausable_init();
        super.initializeAuth(
            _defaultAdmin,
            _pauser,
            _minter,
            _tokenManager,
            _upgrader
        );

        llaToken = _llaToken;
        emit LLATokenUpdated(_llaToken);
        multiSig = _multiSig;
    }

    /**
     * @param _newLLAToken The new LLA token address to be set.
     */
    function updateLLAToken(
        address _newLLAToken
    ) external onlyRole(TOKEN_MANAGER_ROLE) {
        llaToken = _newLLAToken;
        emit LLATokenUpdated(_newLLAToken);
    }

    /**
     * Pause the contract
     */
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * Resume the contract
     */
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * Deposit
     * @param _token The address of the token being transferred.
     * @param _amount The amount of tokens to be transferred.
     */
    function deposit(
        address _token,
        uint256 _amount
    ) public payable whenNotPaused {
        if (isEmpty(supportCoins[_token])) {
            revert UnsupportedToken(_token);
        }
        if (llaToken == address(0)) {
            revert InvalidAddress(address(0));
        }
        if (_amount <= 0) {
            revert InvalidAmount(_amount);
        }
        if (!ERC20(_token).transferFrom(msg.sender, address(this), _amount)) {
            revert TransferFailed(_token, msg.sender, address(this), _amount);
        }

        payments[msg.sender].push(
            Payment({
                payer: msg.sender,
                timestamp: block.timestamp,
                amount: _amount,
                token: _token,
                isWithdrawn: false
            })
        );
        emit PaymentDeposited(msg.sender, block.timestamp, _amount, _token);
        IERC20Mintable token = IERC20Mintable(llaToken);
        token.mint(msg.sender, _amount);
    }

    /**
     * Withdrawal
     * @param _token The address of the token contract.
     * @param _from The address to transfer tokens to.
     * @param _amount The amount of tokens to transfer.
     */
    function withdraw(
        address _token,
        address _from,
        uint _amount
    ) public whenNotPaused {
        if (isEmpty(supportCoins[_token])) {
            revert UnsupportedToken(_token);
        }

        if (msg.sender != multiSig) {
            revert InvalidMultisigAddress(multiSig);
        }
        if (_token == address(0)) {
            revert InvalidAddress(_token);
        }
        if (_from == address(0)) {
            revert InvalidAddress(_from);
        }
        if (_amount <= 0) {
            revert InvalidAmount(_amount);
        }
        if (!ERC20(_token).transferFrom(_from, address(this), _amount)) {
            revert TransferFailed(_token, _from, address(this), _amount);
        }
        payments[msg.sender].push(
            Payment({
                payer: msg.sender,
                timestamp: block.timestamp,
                amount: _amount,
                token: _token,
                isWithdrawn: false
            })
        );
        emit Withdrawal(msg.sender, block.timestamp, _amount, _token);
    }

    /**
     * Newly supported currencies
     * @param _token ERC20 Contract Address
     */
    function addSupportedToken(
        address _token
    ) public onlyRole(TOKEN_MANAGER_ROLE) whenNotPaused {
        if(!isEmpty(supportCoins[_token])){
            revert AlreadyInTheSupportedIcon(_token);
        }
        ERC20 token = ERC20(_token);
        string memory _symbol = token.symbol();
        supportCoins[_token] = _symbol;
        emit TokenAdded(_token, _symbol);
    }

    /**
     * Discontinued supported currencies
     * @param _token ERC20 Contract Address
     */
    function removeSupportedToken(
        address _token
    ) public onlyRole(TOKEN_MANAGER_ROLE) whenNotPaused {
        string memory _symbol = supportCoins[_token];
        if (isEmpty(_symbol)) {
            revert UnsupportedToken(_token);
        }
        supportCoins[_token] = "";
        emit TokenRemoved(_token, _symbol);
    }

    function isEmpty(string memory str) public pure returns (bool) {
        return bytes(str).length == 0;
    }
}

// 假设目标合约的mint函数如下：
interface IERC20Mintable {
    function mint(address to, uint256 amount) external;
    // 必须声明为external或public，否则外部合约无法调用
}
