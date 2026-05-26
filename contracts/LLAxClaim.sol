// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

interface ILLAxToken {
    function mint(address to, uint256 amount) external;
}

contract LLAxClaim is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    ILLAxToken public llaxToken;
    address public ops;

    uint256 public constant MAX_CLAIM_AMOUNT = 10_000_000 * 1e18;
    uint256 public constant MAX_GLOBAL_CLAIM = 1_000_000_000 * 1e18;

    struct ClaimRecord {
        address user;
        uint256 amount;
        uint256 timestamp;
    }

    mapping(bytes32 => ClaimRecord) public claims;
    mapping(address => uint256) public totalClaimed;
    mapping(address => uint256) public claimCount;
    uint256 public globalTotalClaimed;

    event Claimed(address indexed user, uint256 amount, bytes32 indexed nonce, uint256 claimCount);
    event OpsUpdated(address indexed oldOps, address indexed newOps);

    error ZeroAddress();
    error Expired();
    error NonceUsed();
    error ZeroAmount();
    error InvalidSignature();
    error ExceedsUserCap(uint256 amount, uint256 cap);
    error ExceedsGlobalCap(uint256 total, uint256 cap);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _llaxToken, address _ops) public initializer {
        if (_llaxToken == address(0)) revert ZeroAddress();
        if (_ops == address(0)) revert ZeroAddress();

        __Ownable_init(msg.sender);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        llaxToken = ILLAxToken(_llaxToken);
        ops = _ops;
    }

    function claim(uint256 amount, bytes32 nonce, uint256 deadline, bytes calldata signature) external whenNotPaused nonReentrant {
        if (block.timestamp > deadline) revert Expired();
        if (claims[nonce].timestamp != 0) revert NonceUsed();
        if (amount == 0) revert ZeroAmount();
        if (amount > MAX_CLAIM_AMOUNT) revert ExceedsUserCap(amount, MAX_CLAIM_AMOUNT);
        if (globalTotalClaimed + amount > MAX_GLOBAL_CLAIM) revert ExceedsGlobalCap(globalTotalClaimed + amount, MAX_GLOBAL_CLAIM);

        bytes32 hash = keccak256(abi.encodePacked(msg.sender, amount, nonce, deadline, block.chainid, address(this)));
        bytes32 ethSignedHash = hash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);
        if (signer != ops) revert InvalidSignature();

        claims[nonce] = ClaimRecord({user: msg.sender, amount: amount, timestamp: block.timestamp});
        totalClaimed[msg.sender] += amount;
        claimCount[msg.sender] += 1;
        globalTotalClaimed += amount;

        llaxToken.mint(msg.sender, amount);

        emit Claimed(msg.sender, amount, nonce, claimCount[msg.sender]);
    }

    function setOps(address _ops) external onlyOwner {
        if (_ops == address(0)) revert ZeroAddress();
        emit OpsUpdated(ops, _ops);
        ops = _ops;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal view override onlyOwner {
        if (newImplementation == address(0)) revert ZeroAddress();
    }
}
