// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ProductLib, ProductItem} from "./libraries/ProductLib.sol";
import {PurchaseLib, PurchaseRecord} from "./libraries/PurchaseLib.sol";
import {QueryLib} from "./libraries/QueryLib.sol";
import {DecimalConversionLib} from "./libraries/DecimalConversionLib.sol";
import {ProductQueryLib} from "./libraries/ProductQueryLib.sol";
import {AdminLib} from "./libraries/AdminLib.sol";
contract ProductSubscription is
    Initializable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    AccessControlUpgradeable
{
    using SafeERC20 for IERC20;
    using ProductLib for ProductItem[];
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant TOKEN_MANAGER_ROLE =
        keccak256("TOKEN_MANAGER_ROLE");
    bytes32 public constant PRODUCT_MANAGER_ROLE = keccak256("PRODUCT_MANAGER_ROLE");
    
    ProductItem[] public productList;
    mapping(uint256 => ProductItem) private productIdToItem;
    mapping(uint256 => bool) private productExists;
    
    PurchaseRecord[] public purchaseRecords;
    mapping(string => bool) public orderExists;
    mapping(address => uint256[]) public userPurchaseIds;
    mapping(string => uint256) public orderIdToPurchaseId;
    
    uint256[46] private __gap;

    address public multiSig;
    mapping(address => bool) public supportCoins;
    
    // 添加产品计数器，用于高效统计活跃产品数量
    uint256 public activeProductCount;
    
    // V2升级：添加代币精度支持  
    mapping(address => uint8) public tokenDecimals;
    
    event ProductAdded(uint256 indexed productId, uint256 newAmount);
    event ProductUpdated(uint256 indexed productId, uint256 newAmount,uint256 oldAmount);
    event ProductRemoved(uint256 indexed productId);
    event MultiSigUpdated(address indexed newAddress);
    event PaymentDeposited(
        uint256 indexed productId,
        address indexed buyer,
        uint256 when,
        uint256 amount,
        address token,
        uint256 purchaseId
    );
    event TokenAdded(address indexed token, string symbol);
    event TokenRemoved(address indexed token, string symbol);
    event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);

    error Invalid();
    error Exists();
    error NotFound();
    error Unsupported();
    function initialize(address _defaultAdmin, address _pauser, address _tokenManager, address /*_upgrader*/, address _productManager, address _multiSig) public initializer {
        if (_defaultAdmin == address(0) || _pauser == address(0) || _tokenManager == address(0) || _productManager == address(0) || _multiSig == address(0)) revert Invalid();
        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);
        _grantRole(ADMIN_ROLE, _defaultAdmin);
        _grantRole(PAUSER_ROLE, _pauser);
        _grantRole(TOKEN_MANAGER_ROLE, _tokenManager);
        _grantRole(PRODUCT_MANAGER_ROLE, _productManager);
        multiSig = _multiSig;
    }

    function updateMultiSig(address _newMultiSig) external onlyRole(ADMIN_ROLE) {
        if (_newMultiSig == address(0)) revert Invalid();
        multiSig = _newMultiSig;
        emit MultiSigUpdated(_newMultiSig);
    }

    function addProduct(uint256 productId, uint256 amount) external onlyRole(PRODUCT_MANAGER_ROLE) whenNotPaused nonReentrant {
        if (productId == 0 || amount == 0) revert Invalid();
        if (productExists[productId]) revert Exists();
        ProductItem memory newItem = ProductItem(productId, amount);
        productList.push(newItem);
        productIdToItem[productId] = newItem;
        productExists[productId] = true;
        activeProductCount++;
        emit ProductAdded(productId, amount);
    }

    function removeProduct(uint256 productId) external onlyRole(PRODUCT_MANAGER_ROLE) whenNotPaused nonReentrant {
        if (!productExists[productId]) revert NotFound();
        (uint256 index, bool found) = productList.findProductIndex(productId);
        require(found);
        uint256 lastIndex = productList.length - 1;
        if (index != lastIndex) productList[index] = productList[lastIndex];
        productList.pop();
        delete productIdToItem[productId];
        delete productExists[productId];
        activeProductCount--;
        emit ProductRemoved(productId);
    }

    function updateProduct(uint256 productId, uint256 newAmount) external onlyRole(PRODUCT_MANAGER_ROLE) whenNotPaused nonReentrant {
        if (newAmount == 0) revert Invalid();
        if (!productExists[productId]) revert NotFound();
        uint256 oldAmount = productIdToItem[productId].amount;
        ProductItem memory newItem = ProductItem(productId, newAmount);
        productIdToItem[productId] = newItem;
        (uint256 index, bool found) = productList.findProductIndex(productId);
        if (found) productList[index] = newItem;
        emit ProductUpdated(productId, newAmount, oldAmount);
    }

    function getProduct(uint256 productId) public view returns (ProductItem memory) {
        if (!productExists[productId]) revert NotFound();
        return productIdToItem[productId];
    }

    function getProductList() public view returns (ProductItem[] memory) {
        return ProductQueryLib.getProductList(productList, productIdToItem, productExists, activeProductCount);
    }

    function getProductListPaginated(uint256 offset, uint256 limit) public view returns (ProductItem[] memory) {
        return ProductQueryLib.getProductListPaginated(productList, offset, limit);
    }
    
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function revokeRole(bytes32 _role, address _account) public override onlyRole(getRoleAdmin(_role)) {
        _revokeRole(_role, _account);
    }

    function _authorizeUpgrade(address _newImplementation) internal view override {
        if (!hasRole(ADMIN_ROLE, msg.sender)) revert Invalid();
        if (_newImplementation == address(0)) revert Invalid();
        if (_newImplementation.code.length == 0) revert Invalid();
    }

    function purchaseProduct(uint256 productId, string memory orderId, address payToken) external whenNotPaused nonReentrant {
        if (!productExists[productId]) revert NotFound();
        if (payToken == address(0) || !supportCoins[payToken] || bytes(orderId).length == 0) revert Invalid();
        if (orderExists[orderId]) revert Exists();

        uint256 amount = productIdToItem[productId].amount;
        if (amount == 0) revert Invalid();

        uint256 actualPayAmount = DecimalConversionLib.convertPriceForToken(amount, tokenDecimals[payToken]);
        uint256 purchaseId = purchaseRecords.length;

        PurchaseLib.executePayment(payToken, msg.sender, multiSig, actualPayAmount);
        orderExists[orderId] = true;

        purchaseRecords.push(PurchaseLib.createPurchaseRecord(msg.sender, orderId, productId, actualPayAmount, PurchaseLib.getTokenSymbol(payToken)));
        userPurchaseIds[msg.sender].push(purchaseId);
        orderIdToPurchaseId[orderId] = purchaseId;

        emit PaymentDeposited(productId, msg.sender, block.timestamp, actualPayAmount, payToken, purchaseId);
    }

    function addSupportedToken(address _token) public onlyRole(TOKEN_MANAGER_ROLE) whenNotPaused {
        if (_token == address(0)) revert Invalid();
        if (supportCoins[_token]) revert Invalid();
        AdminLib.addSupportedToken(_token, supportCoins, tokenDecimals);
        emit TokenAdded(_token, PurchaseLib.getTokenSymbol(_token));
    }

    function removeSupportedToken(address _token) public onlyRole(TOKEN_MANAGER_ROLE) whenNotPaused {
        if (!supportCoins[_token]) revert Unsupported();
        emit TokenRemoved(_token, PurchaseLib.getTokenSymbol(_token));
        AdminLib.removeSupportedToken(_token, supportCoins, tokenDecimals);
    }

    function emergencyWithdraw(address _token, uint256 _amount) external onlyRole(ADMIN_ROLE) nonReentrant {
        if (_amount == 0) revert Invalid();
        AdminLib.withdrawTokenToMultisig(_token, _amount, multiSig);
        emit EmergencyWithdraw(_token, multiSig, _amount);
    }
    function getPurchaseRecordsByAddress(address _buyer, uint256 _page, uint256 _pageSize) external view returns (PurchaseRecord[] memory) {
        return QueryLib.getPaginatedRecords(purchaseRecords, userPurchaseIds[_buyer], _page, _pageSize);
    }

    function getPurchaseRecordByUserIdAndOrderId(address _buyer, string calldata _orderId) external view returns (PurchaseRecord memory, bool) {
        if (!orderExists[_orderId]) return (PurchaseLib.createEmptyRecord(), false);
        uint256 purchaseId = orderIdToPurchaseId[_orderId];
        if (purchaseId < purchaseRecords.length && purchaseRecords[purchaseId].buyer == _buyer) return (purchaseRecords[purchaseId], true);
        return (PurchaseLib.createEmptyRecord(), false);
    }

    function convertPriceForToken(uint256 baseAmount, address token) external view returns (uint256) {
        return DecimalConversionLib.convertPriceForToken(baseAmount, tokenDecimals[token]);
    }
}
