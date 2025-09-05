// SPDX-License-Identifier: MIT
// 兼容OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.28;
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * 商品项结构
 */
struct ProductItem {
    uint256 productId;
    uint256 totalDays;
    uint256 amount;
}

/**
 * 购买记录结构
 */
struct PurchaseRecord {
    address buyer;
    uint256 productId;
    uint256 amount;
    address token;
    string userId;  // Telegram userId 为字符串格式，如 "6543877705"
    uint256 timestamp;
}

contract ProductSubscription is
    Initializable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    AccessControlUpgradeable
{
    using SafeERC20 for IERC20;
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    // 暂停合约角色
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    // 升级合约角色
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    // 代币管理角色
    bytes32 public constant TOKEN_MANAGER_ROLE =
        keccak256("TOKEN_MANAGER_ROLE");
    
    ProductItem[] public productList;
    // 商品映射（通过 productId 快速查找商品索引）
    mapping(uint256 => uint256) private productIdToIndex;
    
    // 购买记录
    PurchaseRecord[] public purchaseRecords;
    // 用户购买记录映射 (buyer => productId => hasPurchased)
    mapping(address => mapping(uint256 => bool)) public userPurchases;
    // 用户购买记录索引 (buyer => purchaseIds[])
    mapping(address => uint256[]) public userPurchaseIds;

    // 状态变量
    // 用于管理操作的多签钱包地址
    address public multiSig;

    // 合约版本标识
    string public constant version = "v1.0";

    // 代币地址到其支持的映射
    mapping(address => bool) public supportCoins;
    
    // 产品管理角色 - 专门用于商品管理
    bytes32 public constant PRODUCT_MANAGER_ROLE = keccak256("PRODUCT_MANAGER_ROLE");
    
    // 事件
    event ProductAdded(uint256 indexed productId, uint256 newTotalDays, uint256 newAmount); // 商品添加事件
    event ProductUpdated(uint256 indexed productId, uint256 newTotalDays, uint256 newAmount,uint256 oldTotalDays,uint256 oldAmount); // 商品更新事件
    event ProductRemoved(uint256 indexed productId); // 商品移除事件
    event MultiSigUpdated(address indexed newAddress); // 多签地址更新事件
    event PaymentDeposited(
        uint256 indexed productId,
        address indexed buyer,
        string indexed userId,  // Telegram userId 字符串格式
        uint256 when,
        uint256 amount,
        address token,
        uint256 purchaseId
    ); // 支付存入事件
    event TokenAdded(address indexed token, string symbol); // 代币添加事件
    event TokenRemoved(address indexed token, string symbol); // 代币移除事件

    // 自定义错误
    error InvalidAmount(uint256 _amount); // 无效金额错误
    error InvalidAddress(address _address); // 无效地址错误
    error AlreadyInTheSupportedIcon(address _token); // 代币已支持错误
    error InvalidImplementationAddress(address _newImplementation); // 无效实现地址错误
    error InvalidProductId(uint256 _productId);
    error InvalidProductAmount(uint256 _amount);
    error ProductDoesNotExist(uint256 _productId);
    error ProductAlreadyExists(uint256 _productId);
    error UnsupportedPayToken(address _payToken);
    error TokenAddFailed(address _token);
    error TokenRemoveFailed(address _token);
    error InvalidUserId(string _userId);
    // error ProductAlreadyPurchased(address buyer, uint256 productId);

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
        address _multiSig
    ) public initializer {
        if (_defaultAdmin == address(0)) revert InvalidAddress(address(0));
        if (_pauser == address(0)) revert InvalidAddress(address(0));
        if (_tokenManager == address(0)) revert InvalidAddress(address(0));
        if (_upgrader == address(0)) revert InvalidAddress(address(0));
        if (_multiSig == address(0)) revert InvalidAddress(address(0));

        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __AccessControl_init();
        
        // 设置默认管理员角色，这是所有角色管理的根角色
        _grantRole(ADMIN_ROLE, _defaultAdmin);
        _grantRole(PAUSER_ROLE, _pauser);
        _grantRole(UPGRADER_ROLE, _upgrader);
        _grantRole(TOKEN_MANAGER_ROLE, _tokenManager);
        _grantRole(PRODUCT_MANAGER_ROLE, _upgrader); // 默认给upgrader产品管理权限
        multiSig = _multiSig;
    }

    function updateMultiSig(
        address _newMultiSig
    ) external onlyRole(ADMIN_ROLE) {
        if (_newMultiSig == address(0)) revert InvalidAddress(address(0));
        multiSig = _newMultiSig;
        emit MultiSigUpdated(_newMultiSig);
    }

    /**
     * 添加商品
     * @param productId 商品ID
     * @param totalDays 总天数
     * @param amount 金额
     */
    function addProduct(
        uint256 productId,
        uint256 totalDays,
        uint256 amount
    ) external onlyRole(PRODUCT_MANAGER_ROLE) whenNotPaused nonReentrant {
        if (productId == 0) revert InvalidProductId(productId);
        if (amount == 0) revert InvalidProductAmount(amount);
        if(productIdToIndex[productId] != 0){
            revert ProductAlreadyExists(productId);
        }
        ProductItem memory newItem = ProductItem({
            productId: productId,
            totalDays: totalDays,
            amount: amount
        });
        productList.push(newItem);
        productIdToIndex[productId] = productList.length;
        emit ProductAdded(productId,totalDays,amount);
    }

    /**
     * 移除商品
     * @param productId 商品ID
     */
    function removeProduct(
        uint256 productId
    ) external onlyRole(PRODUCT_MANAGER_ROLE) whenNotPaused nonReentrant {
        if(productIdToIndex[productId] == 0){
            revert ProductDoesNotExist(productId);
        }
        uint256 index = productIdToIndex[productId] - 1; // 索引从 0 开始
        uint256 lastIndex = productList.length - 1;
        if(index != lastIndex){
            // 将最后一个商品覆盖到要删除的商品位置
            productList[index] = productList[lastIndex];
            // 更新映射
            productIdToIndex[productList[index].productId] = index + 1;
        }
        // 移除最后一个商品
        productList.pop();

        // 删除映射
        delete productIdToIndex[productId];

        emit ProductRemoved(productId);
    }

    /**
     * 更新商品信息
     * @param productId 商品ID
     * @param newTotalDays 新的总天数
     * @param newAmount 新的金额
     */
    function updateProduct(
        uint256 productId,
        uint256 newTotalDays,
        uint256 newAmount
    ) external onlyRole(PRODUCT_MANAGER_ROLE) whenNotPaused nonReentrant {
        uint256 mappedIndex = productIdToIndex[productId];
        if(mappedIndex == 0){
            revert ProductDoesNotExist(productId);
        }
        if (newAmount == 0) revert InvalidProductAmount(newAmount);
        
        uint256 index = mappedIndex - 1; // 索引从 0 开始
        // 额外的边界检查
        if(index >= productList.length) {
            revert ProductDoesNotExist(productId);
        }
        
        // 安全地获取旧值
        uint256 oldTotalDays = productList[index].totalDays;
        uint256 oldAmount = productList[index].amount;
        
        // 更新商品信息
        productList[index].totalDays = newTotalDays;
        productList[index].amount = newAmount;

        emit ProductUpdated(productId, newTotalDays, newAmount,oldTotalDays,oldAmount);
    }

    /**
     * 获取单个商品信息
     * @param productId 商品ID
     * @return 商品项结构
     */
    function getProduct(
        uint256 productId
    ) public view returns (ProductItem memory) {
        uint256 mappedIndex = productIdToIndex[productId];
        if(mappedIndex == 0){
            revert ProductDoesNotExist(productId);
        }
        uint256 index = mappedIndex - 1;
        // 额外的边界检查
        if(index >= productList.length) {
            revert ProductDoesNotExist(productId);
        }
        return productList[index];
    }

    /**
     * 获取所有商品列表（仅限小规模数据，建议使用分页查询）
     * @return 商品项数组
     */
    function getProductList() public view returns (ProductItem[] memory) {
        // 为防止DOS攻击，限制最大返回100个商品
        uint256 length = productList.length;
        if (length > 100) {
            // 只返回前100个商品
            ProductItem[] memory limitedList = new ProductItem[](100);
            for (uint256 i = 0; i < 100; i++) {
                limitedList[i] = productList[i];
            }
            return limitedList;
        }
        return productList;
    }
    
    /**
     * 分页获取商品列表
     * @param offset 起始位置
     * @param limit 每页数量（最大100）
     * @return 商品项数组
     */
    function getProductListPaginated(
        uint256 offset, 
        uint256 limit
    ) public view returns (ProductItem[] memory) {
        uint256 length = productList.length;
        
        // 限制每页最大100个商品
        if (limit > 100) {
            limit = 100;
        }
        
        // 检查offset是否超出范围
        if (offset >= length) {
            return new ProductItem[](0);
        }
        
        // 计算实际返回数量
        uint256 remaining = length - offset;
        uint256 actualLimit = remaining < limit ? remaining : limit;
        
        ProductItem[] memory result = new ProductItem[](actualLimit);
        for (uint256 i = 0; i < actualLimit; i++) {
            result[i] = productList[offset + i];
        }
        
        return result;
    }
    
    /**
     * 获取商品总数
     * @return 商品总数
     */
    function getProductCount() public view returns (uint256) {
        return productList.length;
    }
    
    /**
     * 检查用户是否购买过某个商品
     * @param buyer 买家地址
     * @param productId 商品ID
     * @return 是否已购买
     */
    function hasUserPurchased(address buyer, uint256 productId) public view returns (bool) {
        return userPurchases[buyer][productId];
    }
    
    /**
     * 获取用户的购买记录数量
     * @param buyer 买家地址
     * @return 购买记录数量
     */
    function getUserPurchaseCount(address buyer) public view returns (uint256) {
        return userPurchaseIds[buyer].length;
    }
    
    /**
     * 获取用户的购买记录ID列表
     * @param buyer 买家地址
     * @return 购买记录ID数组
     */
    function getUserPurchaseIds(address buyer) public view returns (uint256[] memory) {
        return userPurchaseIds[buyer];
    }
    
    /**
     * 获取购买记录总数
     * @return 购买记录总数
     */
    function getPurchaseRecordCount() public view returns (uint256) {
        return purchaseRecords.length;
    }
    
    /**
     * 验证 Telegram UserId 格式
     * @param userId 用户ID字符串
     * @return 是否为有效格式
     */
    function _isValidTelegramUserId(string memory userId) private pure returns (bool) {
        bytes memory userIdBytes = bytes(userId);
        uint256 length = userIdBytes.length;
        
        // Telegram userId 长度通常在 1-20 位数字之间
        if (length == 0 || length > 20) {
            return false;
        }
        
        // 检查是否全部为数字字符
        for (uint256 i = 0; i < length; i++) {
            bytes1 char = userIdBytes[i];
            if (char < 0x30 || char > 0x39) { // 不在 '0'-'9' 范围内
                return false;
            }
        }
        
        return true;
    }
    
    // 添加调试函数来检查 userId 验证
    function checkTelegramUserId(string memory userId) public pure returns (bool) {
        return _isValidTelegramUserId(userId);
    }

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
     * 动态添加角色
     * @param _role 角色
     * @param _account 角色对应的地址
     */
    function addRole(
        bytes32 _role,
        address _account
    ) external onlyRole(ADMIN_ROLE) {
        _grantRole(_role, _account);
    }

    /**
     * 取消对某个地址的角色授权
     * @param _role 角色
     * @param _account 被取消授权的地址
     */
    function revokeRole(
        bytes32 _role,
        address _account
    ) public override onlyRole(ADMIN_ROLE) {
        _revokeRole(_role, _account);
    }

    /**
     * 更新合约实现
     * @param _newImplementation 新实现合约的地址
     */
    function _authorizeUpgrade(
        address _newImplementation
    ) internal view override onlyRole(UPGRADER_ROLE) {
        if (_newImplementation == address(0)) {
            revert InvalidImplementationAddress(_newImplementation);
        }
    }

    /**
     * 购买商品
     * @param productId 商品ID
     * @param payToken 支付代币地址
     * @param userId 用户ID
     */
    function purchaseProduct(
        uint256 productId,
        address payToken,
        string memory userId
    ) external whenNotPaused nonReentrant {
        uint256 mappedIndex = productIdToIndex[productId];
        if(mappedIndex == 0){
            revert ProductDoesNotExist(productId);
        }
        if(payToken == address(0)){
            revert InvalidAddress(payToken);
        }
        if(!supportCoins[payToken]){
            revert UnsupportedPayToken(payToken);
        }
        if(bytes(userId).length == 0){
            revert InvalidUserId(userId);
        }
        
        // 验证 Telegram userId 格式（应该是数字字符串）
        // 临时注释掉严格验证，用于调试
        // if(!_isValidTelegramUserId(userId)){
        //     revert InvalidUserId(userId);
        // }
        
        // // 检查是否已经购买过该商品
        // if(userPurchases[msg.sender][productId]){
        //     revert ProductAlreadyPurchased(msg.sender, productId);
        // }
        
        uint256 index = mappedIndex - 1;
        // 额外的边界检查
        if(index >= productList.length) {
            revert ProductDoesNotExist(productId);
        }
        
        ProductItem memory item = productList[index];
        if (item.amount == 0) revert InvalidProductAmount(item.amount);

        // 将支付从用户转移到多签地址
        // 转账
        IERC20(payToken).safeTransferFrom(
            msg.sender,
            multiSig,
            item.amount
        );
        
        // 记录购买
        userPurchases[msg.sender][productId] = true;
        uint256 purchaseId = purchaseRecords.length;
        purchaseRecords.push(PurchaseRecord({
            buyer: msg.sender,
            productId: productId,
            amount: item.amount,
            token: payToken,
            userId: userId,
            timestamp: block.timestamp
        }));
        userPurchaseIds[msg.sender].push(purchaseId);
        
        emit PaymentDeposited(
            productId,
            msg.sender,
            userId,
            block.timestamp,
            item.amount,
            payToken,
            purchaseId
        );
    }

    /**
     * 添加支持的代币
     * @param _token 代币地址
     */
    function addSupportedToken(
        address _token
    ) public onlyRole(TOKEN_MANAGER_ROLE) whenNotPaused {
        if (supportCoins[_token]) revert AlreadyInTheSupportedIcon(_token);
        if (_token == address(0)) revert InvalidAddress(_token);

        try ERC20(_token).symbol() returns (string memory tokenSymbol) {
            supportCoins[_token] = true;
            emit TokenAdded(_token, tokenSymbol);
        }catch{
            revert TokenAddFailed(_token);
        }
    }

    /**
     * 移除支持的代币
     * @param _token 代币地址
     */
    function removeSupportedToken(
        address _token
    ) public onlyRole(TOKEN_MANAGER_ROLE) whenNotPaused {
        if (!supportCoins[_token]) revert UnsupportedPayToken(_token);
        try ERC20(_token).symbol() returns (string memory tokenSymbol) {
            supportCoins[_token] = false;
            emit TokenRemoved(_token, tokenSymbol);
        }catch{
            revert TokenRemoveFailed(_token);
        }
    }


     /* ========= 查询函数 ========= */

    /// @notice 按 Telegram userId 分页查询购买记录
    /// @param _userId   Telegram userId (字符串)
    /// @param _page     页码，从 1 开始
    /// @param _pageSize 每页条数
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
        require(_page > 0 && _pageSize > 0, "Invalid pagination");

        // 1. 先找出所有匹配记录的索引
        uint256 totalMatches = 0;
        uint256[] memory matchedIdx = new uint256[](purchaseRecords.length);

        for (uint256 i = 0; i < purchaseRecords.length; i++) {
            if (keccak256(bytes(purchaseRecords[i].userId)) == keccak256(bytes(_userId))) {
                matchedIdx[totalMatches++] = i;
            }
        }

        // 2. 计算分页
        uint256 start = (_page - 1) * _pageSize;
        if (start >= totalMatches) {
            return new PurchaseRecord[](0); // 越界，返回空数组
        }

        uint256 end = start + _pageSize;
        if (end > totalMatches) {
            end = totalMatches;
        }

        // 3. 组装结果
        records = new PurchaseRecord[](end - start);
        for (uint256 j = start; j < end; j++) {
            records[j - start] = purchaseRecords[matchedIdx[j]];
        }
    }

}