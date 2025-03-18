// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title MultiSigValidator
 * @dev Contract for verifying multi-signature transactions with enhanced security
 */
contract MultiSigValidator is PausableUpgradeable, OwnableUpgradeable {
    using ECDSA for bytes32;

    address[] public signers;
    uint256 public requiredSignatures;
    uint256 public constant MAX_VALIDITY_PERIOD = 1 hours;
    
    mapping(bytes32 => bool) public executed;
    mapping(address => uint256) public nonces;

    event SignerAdded(address indexed signer);
    event SignerRemoved(address indexed signer);
    event SignatureVerified(bytes32 indexed messageHash, address indexed signer);
    event MultiSigExecuted(bytes32 indexed messageHash, uint256 validSignatures);
    event RequiredSignaturesUpdated(uint256 oldRequired, uint256 newRequired);

    error InvalidSignature();
    error SignatureExpired();
    error InvalidNonce();
    error AlreadyExecuted();
    error InvalidSignersCount();
    error InvalidRequiredSignatures();

    /**
     * @dev Constructor to initialize the validator with signers and required signatures
     * @param _signers Array of signer addresses
     * @param _requiredSignatures Number of required signatures
     */
    constructor(address[] memory _signers, uint256 _requiredSignatures) {
        __Pausable_init();
        __Ownable_init(msg.sender);
        if(_signers.length == 0) revert InvalidSignersCount();
        if(_requiredSignatures == 0 || _requiredSignatures > _signers.length) 
            revert InvalidRequiredSignatures();

        signers = _signers;
        requiredSignatures = _requiredSignatures;
    }

    /**
     * @dev Verify multiple signatures against a message hash
     * @param _messageHash Hash of the message to verify
     * @param _signatures Array of signatures to verify
     * @param _deadline Timestamp after which signatures are invalid
     * @param _nonce Transaction nonce
     * @return bool True if enough valid signatures are provided
     */
    function verifySignatures(
        bytes32 _messageHash,
        bytes[] memory _signatures,
        uint256 _deadline,
        uint256 _nonce
    ) public whenNotPaused returns (bool) {
        if(block.timestamp > _deadline + MAX_VALIDITY_PERIOD) revert SignatureExpired();
        if(_nonce != nonces[msg.sender]) revert InvalidNonce();
        if(executed[_messageHash]) revert AlreadyExecuted();

        bytes32 ethSignedMessageHash = hashMessage(_messageHash);
        uint256 validSignatures = 0;
        bool[] memory usedSigners = new bool[](signers.length);

        for (uint256 i = 0; i < _signatures.length; i++) {
            address signer = recoverSigner(ethSignedMessageHash, _signatures[i]);
            
            for (uint256 j = 0; j < signers.length; j++) {
                if (signer == signers[j] && !usedSigners[j]) {
                    usedSigners[j] = true;
                    validSignatures++;
                    emit SignatureVerified(_messageHash, signer);
                    break;
                }
            }
        }

        if(validSignatures >= requiredSignatures) {
            executed[_messageHash] = true;
            nonces[msg.sender]++;
            emit MultiSigExecuted(_messageHash, validSignatures);
            return true;
        }
        return false;
    }

    /**
     * @dev Hash message with Ethereum signed message prefix
     * @param _message Message to hash
     * @return bytes32 Ethereum signed message hash
     */
    function hashMessage(bytes32 _message) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            _message
        ));
    }

    /**
     * @dev Recover signer's address from signature
     * @param _messageHash Hash of the signed message
     * @param _signature Signature to recover from
     * @return address Recovered signer's address
     */
    function recoverSigner(
        bytes32 _messageHash,
        bytes memory _signature
    ) internal pure returns (address) {
        if(_signature.length != 65) revert InvalidSignature();

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := byte(0, mload(add(_signature, 96)))
        }

        if (v < 27) v += 27;
        if (v != 27 && v != 28) revert InvalidSignature();

        address recoveredAddress = ecrecover(_messageHash, v, r, s);
        if(recoveredAddress == address(0)) revert InvalidSignature();

        return recoveredAddress;
    }

    /**
     * @dev Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Update required number of signatures
     * @param _newRequired New number of required signatures
     */
    function updateRequiredSignatures(uint256 _newRequired) external onlyOwner {
        if(_newRequired == 0 || _newRequired > signers.length) 
            revert InvalidRequiredSignatures();
        
        uint256 oldRequired = requiredSignatures;
        requiredSignatures = _newRequired;
        emit RequiredSignaturesUpdated(oldRequired, _newRequired);
    }

    /**
     * @dev Generate message hash with current contract state
     * @param _data Transaction data to hash
     * @param _nonce Transaction nonce
     * @param _deadline Timestamp deadline
     * @return bytes32 Generated message hash
     */
    function generateMessageHash(
        bytes memory _data,
        uint256 _nonce,
        uint256 _deadline
    ) public view returns (bytes32) {
        return keccak256(abi.encodePacked(
            address(this),
            block.chainid,
            _nonce,
            _deadline,
            _data
        ));
    }
}