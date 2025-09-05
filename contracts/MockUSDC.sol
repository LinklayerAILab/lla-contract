
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * @title MockUSDC Token Contract
 * @author Jason Chen
 * @notice This contract implements a simple MockUSDC token for testing purposes using native Solidity
 */
contract MockUSDC {
    /// @notice Token name
    string public name = "MockUSDC";
    /// @notice Token symbol
    string public symbol = "MockUSDC";
    /// @notice Token decimals
    uint8 public decimals = 6;
    /// @notice Current version of the contract
    string public constant version = "v1.0";
    /// @notice Total supply of MockUSDC tokens
    uint256 public constant TOTAL_SUPPLY = 100_0000_0000 * 1e6;
    
    /// @notice Total supply of tokens
    uint256 public totalSupply;
    /// @notice Contract owner
    address public owner;
    
    /// @notice Mapping of balances
    mapping(address => uint256) public balanceOf;
    /// @notice Mapping of allowances
    mapping(address => mapping(address => uint256)) public allowance;
    
    /// @notice Event emitted when tokens are transferred
    event Transfer(address indexed from, address indexed to, uint256 value);
    /// @notice Event emitted when approval is set
    event Approval(address indexed owner, address indexed spender, uint256 value);
    /// @notice Event emitted when ownership is transferred
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /// @notice Error thrown when an invalid address is provided
    /// @param addr The invalid address that was provided
    error InvalidAddress(address addr);
    /// @notice Error thrown when an invalid amount is provided
    /// @param amount The invalid amount that was provided
    error InvalidAmount(uint amount);
    /// @notice Error thrown when insufficient balance
    error InsufficientBalance();
    /// @notice Error thrown when insufficient allowance
    error InsufficientAllowance();
    /// @notice Error thrown when not owner
    error NotOwner();

    /// @notice Modifier to check if caller is owner
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /**
     * @notice Initializes the MockUSDC contract
     * @param initialOwner Address to be granted owner role
     */
    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert InvalidAddress(initialOwner);
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    /**
     * @notice Transfer ownership to a new address
     * @param newOwner Address of the new owner
     */
    function transferOwnership(address newOwner) public onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress(newOwner);
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /**
     * @notice Renounce ownership
     */
    function renounceOwnership() public onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }

    /**
     * @notice Transfer tokens to another address
     * @param to Address to transfer to
     * @param amount Amount to transfer
     */
    function transfer(address to, uint256 amount) public returns (bool) {
        if (to == address(0)) revert InvalidAddress(to);
        if (balanceOf[msg.sender] < amount) revert InsufficientBalance();
        
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    /**
     * @notice Transfer tokens from one address to another
     * @param from Address to transfer from
     * @param to Address to transfer to
     * @param amount Amount to transfer
     */
    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        if (to == address(0)) revert InvalidAddress(to);
        if (balanceOf[from] < amount) revert InsufficientBalance();
        if (allowance[from][msg.sender] < amount) revert InsufficientAllowance();
        
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        
        emit Transfer(from, to, amount);
        return true;
    }

    /**
     * @notice Approve another address to spend tokens
     * @param spender Address to approve
     * @param amount Amount to approve
     */
    function approve(address spender, uint256 amount) public returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /**
     * @notice Creates new tokens and assigns them to an address
     * @dev Can only be called by the owner
     * @param to Address to receive the minted tokens
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) public onlyOwner {
        if(amount == 0) revert InvalidAmount(amount);
        if(to == address(0)) revert InvalidAddress(to);
        
        totalSupply += amount;
        balanceOf[to] += amount;
        
        emit Transfer(address(0), to, amount);
    }

    /**
     * @notice Burns tokens from the caller's account
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) public {
        if(amount == 0) revert InvalidAmount(amount);
        if(balanceOf[msg.sender] < amount) revert InsufficientBalance();
        
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        
        emit Transfer(msg.sender, address(0), amount);
    }

    /**
     * @notice Burns tokens from another address (requires allowance)
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burnFrom(address from, uint256 amount) public {
        if(amount == 0) revert InvalidAmount(amount);
        if(balanceOf[from] < amount) revert InsufficientBalance();
        if(allowance[from][msg.sender] < amount) revert InsufficientAllowance();
        
        balanceOf[from] -= amount;
        allowance[from][msg.sender] -= amount;
        totalSupply -= amount;
        
        emit Transfer(from, address(0), amount);
    }
}