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
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";



/**
 * 商品项结构
 */
struct ProductItem {
    uint8 productId;
    uint256 totalDays;
    uint256 amount;
}

contract AgentScribe is
    Initializable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    AccessControlUpgradeable
{
    using SafeERC20 for IERC20;
    using Math for uint256;
    // 管理员角色
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
    mapping(uint8 => uint256) private productIdToIndex;

    address public vaultContractAddr;
    // 状态变量
    // 用于管理操作的多签钱包地址
    address public multiSig;
    // LLAx代币合约地址
    address public token;
    // 总铸币操作次数
    uint256 public totalMintCount;
    // 分配给多签地址的资金比例
    uint256 public FUNDING_RATE; // 30%
    // LLAX代币的铸币率
    uint256 public MINTING_RATE; // 60%

    // 合约版本标识
    string public constant version = "v1.0";
    // 记录地址的铸币状态
    mapping(address => bool) private _minting;
    // 代币地址到其支持的映射

    mapping(address => bool) public supportCoins;
    // 事件
    event ProductAdded(uint8 indexed productId, uint256 newTotalDays, uint256 newAmount); // 商品添加事件
    event ProductUpdated(uint8 indexed productId, uint256 newTotalDays, uint256 newAmount,uint256 oldTotalDays,uint256 oldAmount); // 商品更新事件
    event ProductRemoved(uint8 indexed productId); // 商品移除事件
    event MintToAddress(address indexed to, uint256 amount); // 代币铸造事件
    event TokenUpdated(address indexed newAddress); // 代币地址更新事件
    event MultiSigUpdated(address indexed newAddress); // 多签地址更新事件
    event PaymentDeposited(
        uint8 indexed projectId,
        uint256 when,
        uint256 amount,
        address token
    ); // 支付存入事件
    event FundingRateUpdated(uint256 newRate); // 资金分配比例更新事件
    event MintingRateUpdated(uint256 newRate); // 铸币率更新事件
    event TokenAdded(address indexed token, string symbol); // 代币添加事件
    event TokenRemoved(address indexed token, string symbol); // 代币移除事件

    // 自定义错误
    error InvalidAmount(uint256 _amount); // 无效金额错误
    error InvalidAddress(address _address); // 无效地址错误
    error AlreadyInTheSupportedIcon(address _token); // 代币已支持错误
    error MintingInProgress(); // 铸币进行中错误
    error MintingFailed(); // 铸币失败错误
    error InvalidImplementationAddress(address _newImplementation); // 无效实现地址错误
    error InvalidProductId(uint8 _productId);
    error InvalidProductAmount(uint256 _amount);
    error ProductDoesNotExist(uint8 _productId);
    error ProductAlreadyExists(uint8 _productId);
    error UnsupportedPayToken(address _payToken);
    error TokenAddFailed(address _token);
    error TokenRemoveFailed(address _token);
    /**
     * 初始化合约
     * @param _vaultContractAddr 金库合约地址
     * @param _defaultAdmin 默认管理员地址
     * @param _pauser 暂停权限地址
     * @param _tokenManager 代币管理员地址
     * @param _upgrader 升级权限地址
     * @param _token LLA代币地址
     * @param _multiSig 多签地址
     */
    function initialize(
        address _vaultContractAddr,
        address _defaultAdmin,
        address _pauser,
        address _tokenManager,
        address _upgrader,
        address _token,
        address _multiSig
    ) public initializer {
        if (_vaultContractAddr == address(0)) revert InvalidAddress(address(0));
        if (_defaultAdmin == address(0)) revert InvalidAddress(address(0));
        if (_pauser == address(0)) revert InvalidAddress(address(0));
        if (_tokenManager == address(0)) revert InvalidAddress(address(0));
        if (_upgrader == address(0)) revert InvalidAddress(address(0));
        if (_token == address(0)) revert InvalidAddress(address(0));
        if (_multiSig == address(0)) revert InvalidAddress(address(0));

        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __AccessControl_init();
        _grantRole(ADMIN_ROLE, _defaultAdmin);
        _grantRole(PAUSER_ROLE, _pauser);
        _grantRole(UPGRADER_ROLE, _upgrader);
        _grantRole(TOKEN_MANAGER_ROLE, _tokenManager);
        FUNDING_RATE = 30;
        MINTING_RATE = 60;
        vaultContractAddr = _vaultContractAddr;
        token = _token;
        multiSig = _multiSig;
        emit TokenUpdated(_token);
    }

    /**
     * 更新代币地址
     * @param _newToken 新的代币地址
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
     * 添加商品
     * @param productId 商品ID
     * @param totalDays 总天数
     * @param amount 金额
     */
    function addProduct(
        uint8 productId,
        uint256 totalDays,
        uint256 amount
    ) external onlyRole(UPGRADER_ROLE) whenNotPaused nonReentrant {
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
        uint8 productId
    ) external onlyRole(UPGRADER_ROLE) whenNotPaused nonReentrant {
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
        uint8 productId,
        uint256 newTotalDays,
        uint256 newAmount
    ) external onlyRole(UPGRADER_ROLE) whenNotPaused nonReentrant {
        if(productIdToIndex[productId] == 0){
            revert ProductDoesNotExist(productId);
        }
        uint256 oldTotalDays = productList[productIdToIndex[productId] - 1].totalDays;
        uint256 oldAmount = productList[productIdToIndex[productId] - 1].amount;
        if (newAmount == 0) revert InvalidProductAmount(newAmount);
        uint256 index = productIdToIndex[productId] - 1; // 索引从 0 开始
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
        uint8 productId
    ) public view returns (ProductItem memory) {
        if(productIdToIndex[productId] == 0){
            revert ProductDoesNotExist(productId);
        }
        uint256 index = productIdToIndex[productId] - 1;
        return productList[index];
    }

    /**
     * 获取所有商品列表
     * @return 商品项数组
     */
    function getProductList() public view returns (ProductItem[] memory) {
        return productList;
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
     */
    function purchaseProduct(
        uint8 productId,
        address payToken
    ) external whenNotPaused nonReentrant {
        if(productIdToIndex[productId] == 0){
            revert ProductDoesNotExist(productId);
        }
        if(payToken == address(0)){
            revert InvalidAddress(payToken);
        }
        if(!supportCoins[payToken]){
            revert UnsupportedPayToken(payToken);
        }
        if (_minting[msg.sender]) revert MintingInProgress();
        _minting[msg.sender] = true;
        uint256 index = productIdToIndex[productId] - 1;
        ProductItem memory item = productList[index];
        if (item.amount == 0) revert InvalidProductAmount(item.amount);
        // 为用户铸造LLA代币
        uint256 mintAmount = item.amount.mulDiv(MINTING_RATE, 100);
        try IERC20Mintable(token).mint(msg.sender, mintAmount) {
            emit MintToAddress(msg.sender, mintAmount);
            totalMintCount++; // 增加总铸币计数
        } catch {
            _minting[msg.sender] = false;
            revert MintingFailed();
        }

        uint256 sendAmountToMultisig = item.amount.mulDiv(FUNDING_RATE, 100);
        uint256 sendAmountToVault = item.amount - sendAmountToMultisig;
        // 将支付从用户转移到多签地址
        IERC20(payToken).safeTransferFrom(
            msg.sender,
            multiSig,
            sendAmountToMultisig
        );
        // 将支付从用户转移到金库合约
        IERC20(payToken).safeTransferFrom(
            msg.sender,
            vaultContractAddr,
            sendAmountToVault
        );
        emit PaymentDeposited(
            productId,
            block.timestamp,
            item.amount,
            payToken
        );

        // 重置铸币状态
        _minting[msg.sender] = false;
    }

    /**
     * 更新资金分配比例
     * @param newRate 新的比例(0-100)
     */
    function updateFundingRate(
        uint256 newRate
    ) external onlyRole(UPGRADER_ROLE) whenNotPaused nonReentrant {
        require(newRate <= 100, "Rate must be <= 100");
        FUNDING_RATE = newRate;
        emit FundingRateUpdated(newRate);
    }

    /**
     * 更新铸币率
     * @param newRate 新的比例(0-100)
     */
    function updateMintingRate(
        uint256 newRate
    ) external onlyRole(UPGRADER_ROLE) whenNotPaused nonReentrant {
        require(newRate <= 100, "Rate must be <= 100");
        MINTING_RATE = newRate;
        emit MintingRateUpdated(newRate);
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

        try ERC20(_token).symbol() returns (string memory) {
            supportCoins[_token] = true;
            // 获取 symbol 仅用于事件，不存储
            ERC20 myToken = ERC20(_token);
            string memory tokenSymbol = myToken.symbol();
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
        try ERC20(_token).symbol() returns (string memory) {
            // 获取 symbol 仅用于事件，不存储
            ERC20 myToken = ERC20(_token);
            string memory tokenSymbol = myToken.symbol();
            supportCoins[_token] = false; // 或者 delete supportCoins[_token];
            emit TokenRemoved(_token, tokenSymbol);
        }catch{
            revert TokenRemoveFailed(_token);
        }
    }
}

/**@notice Interface for ERC20 tokens with minting capability
 */
interface IERC20Mintable {
    event Minting(address indexed to, uint256 amount);
     function mint(address to, uint256 amount) external;
}

