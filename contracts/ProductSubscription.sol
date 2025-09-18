// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "./libraries/ValidationLib.sol";
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
    using ValidationLib for address;
    using ValidationLib for string;
    using ProductLib for uint256;
    using ProductLib for ProductItem[];
    using PurchaseLib for address;
    using QueryLib for PurchaseRecord[];
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant TOKEN_MANAGER_ROLE =
        keccak256("TOKEN_MANAGER_ROLE");
    bytes32 public constant PRODUCT_MANAGER_ROLE = keccak256("PRODUCT_MANAGER_ROLE");
    
    ProductItem[] public productList;
    mapping(uint256 => ProductItem) private productIdToItem;
    mapping(uint256 => bool) private productExists;
    
    PurchaseRecord[] public purchaseRecords;
    mapping(string => bool) public orderExists;
    mapping(address => uint256[]) public userPurchaseIds;
    mapping(bytes32 => uint256[]) public userIdToPurchaseIds;
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
        string indexed userId,
        uint256 when,
        uint256 amount,
        address token,
        uint256 purchaseId
    );
    event TokenAdded(address indexed token, string symbol);
    event TokenRemoved(address indexed token, string symbol);

    error Invalid();
    error Exists();
    error NotFound();
    error Unsupported();
/**
    * 初始化合约
     * @param _defaultAdmin 默认管理员地址
     * @param _pauser 暂停权限地址
     * @param _tokenManager 代币管理员地址
     * @param _upgrader 升级权限地址
     * @param _productManager 产品管理员地址
     * @param _multiSig 多签地址
 */
    function initialize(
        address _defaultAdmin,
        address _pauser,
        address _tokenManager,
        address _upgrader,
        address _productManager,
        address _multiSig
    ) public initializer {
        if (_defaultAdmin == address(0) || _pauser == address(0) || _tokenManager == address(0) || _upgrader == address(0) || _productManager == address(0) || _multiSig == address(0)) revert Invalid();

        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __AccessControl_init();
        
        // 修复：分离角色权限，减少集中化风险
        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin); // 给予超级管理员权限以管理其他角色
        _grantRole(ADMIN_ROLE, _defaultAdmin);
        _grantRole(PAUSER_ROLE, _pauser);
        _grantRole(UPGRADER_ROLE, _upgrader);
        _grantRole(TOKEN_MANAGER_ROLE, _tokenManager);
        _grantRole(PRODUCT_MANAGER_ROLE, _productManager);
        
        
        multiSig = _multiSig;
    }

    function updateMultiSig(
        address _newMultiSig
    ) external onlyRole(ADMIN_ROLE) {
        if (_newMultiSig == address(0)) revert Invalid();
        multiSig = _newMultiSig;
        emit MultiSigUpdated(_newMultiSig);
    }

    /**
     * 添加商品
     * @param productId 商品ID
     * @param amount 金额
     */
    function addProduct(
        uint256 productId,
        uint256 amount
    ) external onlyRole(PRODUCT_MANAGER_ROLE) whenNotPaused nonReentrant {
        if (productId == 0 || amount == 0) revert Invalid();
        if (productExists[productId]) revert Exists();
        
        ProductItem memory newItem = ProductItem({
            productId: productId,
            amount: amount
        });
        
        productList.push(newItem);
        productIdToItem[productId] = newItem;
        productExists[productId] = true;
        activeProductCount++; // 增加计数器
        
        emit ProductAdded(productId,amount);
    }

    /**
     * 移除商品
     * @param productId 商品ID
     */
    function removeProduct(
        uint256 productId
    ) external onlyRole(PRODUCT_MANAGER_ROLE) whenNotPaused nonReentrant {
        if (!productExists[productId]) revert NotFound();
        
        (uint256 index, bool found) = productList.findProductIndex(productId);
        require(found);
        
        uint256 lastIndex = productList.length - 1;
        if(index != lastIndex){
            // 将最后一个商品覆盖到要删除的商品位置
            productList[index] = productList[lastIndex];
        }
        
        // 移除最后一个商品
        productList.pop();

        // 删除映射
        delete productIdToItem[productId];
        delete productExists[productId];
        activeProductCount--; // 减少计数器

        emit ProductRemoved(productId);
    }

    /**
     * 更新商品信息
     * @param productId 商品ID
     * @param newAmount 新的金额
     */
    function updateProduct(
        uint256 productId,
        uint256 newAmount
    ) external onlyRole(PRODUCT_MANAGER_ROLE) whenNotPaused nonReentrant {
        if (newAmount == 0) revert Invalid();
        if (!productExists[productId]) revert NotFound();
        
        // 从直接映射获取旧值
        ProductItem memory oldItem = productIdToItem[productId];
        uint256 oldAmount = oldItem.amount;
        
        // 创建新的产品项
        ProductItem memory newItem = ProductItem({
            productId: productId,
            amount: newAmount
        });
        
        // 更新直接映射
        productIdToItem[productId] = newItem;
        
        (uint256 index, bool found) = productList.findProductIndex(productId);
        if (found) {
            productList[index] = newItem;
        }

        emit ProductUpdated(productId, newAmount, oldAmount);
    }

    /**
     * 获取单个商品信息
     * @param productId 商品ID
     * @return 商品项结构
     */
    function getProduct(
        uint256 productId
    ) public view returns (ProductItem memory) {
        if (!productExists[productId]) revert NotFound();
        return productIdToItem[productId];
    }

    /**
     * 获取所有商品列表（委托给库函数）
     * @return 商品项数组
     */
    function getProductList() public view returns (ProductItem[] memory) {
        return ProductQueryLib.getProductList(productList, productIdToItem, productExists, activeProductCount);
    }
    
    /**
     * 分页获取商品列表（委托给库函数）
     * @param offset 起始位置
     * @param limit 每页数量（最大50）
     * @return 商品项数组
     */
    function getProductListPaginated(uint256 offset, uint256 limit) public view returns (ProductItem[] memory) {
        return ProductQueryLib.getProductListPaginated(productList, offset, limit);
    }
    
    
    
    
    
    
    
    /**
     * 获取购买记录总数
     * @return 购买记录总数
     */
    
    

    /**
     * 暂停合约操作
     */
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * 恢复合约操作
     */
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }


    /**
     * 取消对某个地址的角色授权
     * @param _role 角色
     * @param _account 被取消授权的地址
     */
    function revokeRole(
        bytes32 _role,
        address _account
    ) public override onlyRole(getRoleAdmin(_role)) {
        // 修复：使用角色管理层次，而不是直接使用ADMIN_ROLE
        _revokeRole(_role, _account);
    }

    /**
     * 更新合约实现 - 增强安全性检查
     * @param _newImplementation 新实现合约的地址
     */
    function _authorizeUpgrade(
        address _newImplementation
    ) internal view override {
        // 安全修复：只允许ADMIN_ROLE升级合约，确保最高级别的安全控制
        require(
            hasRole(ADMIN_ROLE, msg.sender),
            "Only admin can upgrade"
        );
        
        if (_newImplementation == address(0)) revert Invalid();
        
        // 修复：移除assembly代码，使用更安全的检查方式
        _validateNewImplementation(_newImplementation);
    }
    
    function _validateNewImplementation(address impl) private view {
        require(impl.code.length > 0);
    }

    /**
     * 购买商品
     * @param productId 商品ID
     * @param orderId 订单ID
     * @param payToken 支付代币地址
     * @param userId 用户ID
     */
    function purchaseProduct(
        uint256 productId,
        string memory orderId,
        address payToken,
        string memory userId
    ) external whenNotPaused nonReentrant {
        // 修复：使用O(1)检查产品是否存在
        if (!productExists[productId]) {
            revert NotFound();
        }
        if (payToken == address(0) || !supportCoins[payToken] || bytes(orderId).length == 0 || bytes(userId).length == 0) revert Invalid();
        
        if(!userId.isValidTelegramUserId()) revert Invalid();
        
        if(orderExists[orderId]) revert Exists();
        
        // 修复：直接从映射获取产品信息
        ProductItem memory item = productIdToItem[productId];
        if (item.amount == 0) revert Invalid();

        // V2升级：根据代币精度计算实际支付金额
        uint256 actualPayAmount = DecimalConversionLib.convertPriceForToken(item.amount, tokenDecimals[payToken]);
        
        uint256 purchaseId = purchaseRecords.length;
        string memory symbol = PurchaseLib.getTokenSymbol(payToken);
        
        PurchaseLib.executePayment(payToken, msg.sender, multiSig, actualPayAmount);
        
        // 转账成功后才更新状态，保证原子性
        orderExists[orderId] = true;
        
        purchaseRecords.push(PurchaseLib.createPurchaseRecord(
            msg.sender,
            orderId,
            productId,
            actualPayAmount, // V2升级：记录实际支付的金额
            userId,
            symbol
        ));
        
        userPurchaseIds[msg.sender].push(purchaseId);
        
        // 添加索引映射以提高查询效率
        bytes32 userIdHash = keccak256(bytes(userId));
        userIdToPurchaseIds[userIdHash].push(purchaseId);
        orderIdToPurchaseId[orderId] = purchaseId;
        
        emit PaymentDeposited(
            productId,
            msg.sender,
            userId,
            block.timestamp,
            actualPayAmount, // V2升级：事件中记录实际支付金额
            payToken,
            purchaseId
        );
    }

    /**
     * 添加支持的代币 (V2升级版本，支持精度处理)
     * @param _token 代币地址
     */
    function addSupportedToken(
        address _token
    ) public onlyRole(TOKEN_MANAGER_ROLE) whenNotPaused {
        if (_token == address(0)) revert Invalid();
        if (supportCoins[_token]) revert Invalid();
        AdminLib.addSupportedToken(_token, supportCoins, tokenDecimals);
        string memory tokenSymbol = PurchaseLib.getTokenSymbol(_token);
        emit TokenAdded(_token, tokenSymbol);
    }

    /**
     * 移除支持的代币 (V2升级版本)
     * @param _token 代币地址
     */
    function removeSupportedToken(
        address _token
    ) public onlyRole(TOKEN_MANAGER_ROLE) whenNotPaused {
        if (!supportCoins[_token]) revert Unsupported();
        string memory tokenSymbol = PurchaseLib.getTokenSymbol(_token);
        AdminLib.removeSupportedToken(_token, supportCoins, tokenDecimals);
        emit TokenRemoved(_token, tokenSymbol);
    }


     /* ========= 查询函数 ========= */

    /// @notice 按 Telegram userId 分页查询购买记录 (优化版本，使用索引映射)
    /// @param _userId   Telegram userId (字符串)
    /// @param _page     页码，从 1 开始 (最大1000页)
    /// @param _pageSize 每页条数 (最多50条)
    /// @return records  当前页的记录
    function getPurchaseRecordsByTelegramUserId(
        string calldata _userId,
        uint256 _page,
        uint256 _pageSize
    )
        external
        view
        returns (PurchaseRecord[] memory records)
    {
        bytes32 userIdHash = keccak256(bytes(_userId));
        uint256[] memory matchedPurchaseIds = userIdToPurchaseIds[userIdHash];
        
        return QueryLib.getPaginatedRecords(purchaseRecords, matchedPurchaseIds, _page, _pageSize);
    }

    /// @notice 根据 userId 和 orderId 查询单个购买记录 (优化版本，使用直接索引)
    /// @param _userId 用户ID (字符串)
    /// @param _orderId 订单ID
    /// @return record 匹配的购买记录，如果未找到则返回空记录
    /// @return found 是否找到匹配记录
    function getPurchaseRecordByUserIdAndOrderId(
        string calldata _userId,
        string calldata _orderId
    )
        external
        view
        returns (PurchaseRecord memory record, bool found)
    {
        // 修复：使用直接索引查询，兼容旧版本
        if (!orderExists[_orderId]) {
            return (PurchaseLib.createEmptyRecord(), false);
        }
        
        uint256 purchaseId = orderIdToPurchaseId[_orderId];
        
        // 检查订单ID是否存在且索引有效
        if (purchaseId < purchaseRecords.length) {
            PurchaseRecord memory foundRecord = purchaseRecords[purchaseId];
            // 修复：预计算hash值，避免重复计算
            bytes32 userIdHash = keccak256(bytes(_userId));
            bytes32 recordUserIdHash = keccak256(bytes(foundRecord.userId));
            
            if (userIdHash == recordUserIdHash) {
                return (foundRecord, true);
            }
        }
        
        return (PurchaseLib.createEmptyRecord(), false);
    }

    /* ========= V2升级：精度转换函数 ========= */
    
    /**
     * 获取基准精度常量
     */
    function BASE_DECIMALS() public pure returns (uint8) {
        return DecimalConversionLib.BASE_DECIMALS;
    }

    /**
     * V2升级：根据代币精度转换产品价格（委托给库函数）
     * @param baseAmount 基准价格 (产品存储的原始价格，假设为18位精度)
     * @param token 支付代币地址
     * @return 转换后的实际支付金额
     */
    function convertPriceForToken(uint256 baseAmount, address token) public view returns (uint256) {
        return DecimalConversionLib.convertPriceForToken(baseAmount, tokenDecimals[token]);
    }




}
