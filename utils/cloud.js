// utils/cloud.js
// 云函数调用封装工具类

/**
 * 获取存储的token
 */
function getToken() {
  try {
    return wx.getStorageSync('token') || getApp().globalData.token;
  } catch (e) {
    console.error('Get token error:', e);
    return null;
  }
}

/**
 * 获取用户信息
 */
function getUserInfo() {
  try {
    return wx.getStorageSync('userInfo') || getApp().globalData.userInfo;
  } catch (e) {
    console.error('Get userInfo error:', e);
    return null;
  }
}

/**
 * 云函数调用封装
 * @param {string} name 云函数名称
 * @param {object} data 传递的参数
 * @returns {Promise}
 */
function callCloudFunction(name, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: name,
      data: data,
      success: res => {
        console.log(`[Cloud] ${name} success:`, res.result);
        if (res.result && res.result.success !== false) {
          resolve(res.result);
        } else {
          reject(res.result || { error: '请求失败' });
        }
      },
      fail: err => {
        console.error(`[Cloud] ${name} failed:`, err);
        reject({
          success: false,
          error: err.errMsg || '网络请求失败'
        });
      }
    });
  });
}

/**
 * 检查云开发是否初始化
 */
function checkCloudInit() {
  if (!wx.cloud) {
    wx.showModal({
      title: '提示',
      content: '请使用微信开发者工具或最新版本微信体验云开发',
      showCancel: false
    });
    return false;
  }
  return true;
}

/**
 * 显示加载提示
 */
function showLoading(title = '加载中...') {
  wx.showLoading({
    title: title,
    mask: true
  });
}

/**
 * 隐藏加载提示
 */
function hideLoading() {
  wx.hideLoading();
}

/**
 * 显示错误提示
 */
function showError(title = '操作失败', duration = 2000) {
  wx.showToast({
    title: title,
    icon: 'none',
    duration: duration
  });
}

/**
 * 显示成功提示
 */
function showSuccess(title = '操作成功', duration = 2000) {
  wx.showToast({
    title: title,
    icon: 'success',
    duration: duration
  });
}

// ==================== 认证相关 ====================

/**
 * 微信登录
 * @param {string} code wx.login()获取的code
 * @param {object} userInfo 用户信息
 */
function login(code, userInfo) {
  return callCloudFunction('login', {
    code: code,
    userInfo: userInfo
  });
}

// ==================== 用户相关 ====================

/**
 * 获取用户资料
 */
function getUserProfile() {
  return callCloudFunction('getUserProfile', {
    token: getToken()
  });
}

/**
 * 更新用户资源
 * @param {array} resources 资源列表
 */
function updateUserResources(resources) {
  showLoading('更新中...');
  return callCloudFunction('updateUserResources', {
    token: getToken(),
    resources: resources
  }).finally(() => hideLoading());
}

/**
 * 更新隐私设置
 * @param {boolean} showOnMap 是否在地图上显示
 */
function updatePrivacySetting(showOnMap) {
  return callCloudFunction('updatePrivacySetting', {
    token: getToken(),
    showOnMap: showOnMap
  });
}

/**
 * 更新用户位置
 * @param {object} location 位置信息 {latitude, longitude, accuracy}
 */
function updateUserLocation(location) {
  return callCloudFunction('updateUserLocation', {
    token: getToken(),
    location: location
  });
}

// ==================== 求助相关 ====================

/**
 * 创建求助请求
 * @param {string} type 帮助类型
 * @param {string} note 补充说明
 * @param {object} location 位置信息
 */
function createHelpRequest(type, note, location) {
  showLoading('正在提交...');
  return callCloudFunction('createHelpRequest', {
    token: getToken(),
    type: type,
    note: note,
    location: location
  }).finally(() => hideLoading());
}

/**
 * 获取求助请求状态
 * @param {string} requestId 请求ID
 */
function getHelpRequestStatus(requestId) {
  return callCloudFunction('getHelpRequestStatus', {
    token: getToken(),
    requestId: requestId
  });
}

/**
 * 取消求助请求
 * @param {string} requestId 请求ID
 */
function cancelHelpRequest(requestId) {
  showLoading('取消中...');
  return callCloudFunction('cancelHelpRequest', {
    token: getToken(),
    requestId: requestId
  }).finally(() => hideLoading());
}

/**
 * 完成互助
 * @param {string} requestId 请求ID
 */
function completeHelp(requestId) {
  showLoading('提交中...');
  return callCloudFunction('completeHelp', {
    token: getToken(),
    requestId: requestId
  }).finally(() => hideLoading());
}

// ==================== 附近用户相关 ====================

/**
 * 获取附近用户
 * @param {object} location 位置信息
 * @param {number} radius 搜索半径（米）
 * @param {number} limit 返回数量限制
 */
function getNearbyUsers(location, radius = 2000, limit = 20) {
  return callCloudFunction('getNearbyUsers', {
    token: getToken(),
    location: location,
    radius: radius,
    limit: limit
  });
}

// ==================== 联系相关 ====================

/**
 * 联系用户
 * @param {string} targetUserId 目标用户ID
 * @param {string} type 类型
 */
function contactUser(targetUserId, type) {
  showLoading('发送中...');
  return callCloudFunction('contactUser', {
    token: getToken(),
    targetUserId: targetUserId,
    type: type
  }).finally(() => hideLoading());
}

// ==================== 情绪支持相关 ====================

/**
 * 情绪支持
 * @param {string} message 用户输入
 */
function emotionSupport(message) {
  showLoading('正在倾听...');
  return callCloudFunction('emotionSupport', {
    token: getToken(),
    message: message
  }).finally(() => hideLoading());
}

module.exports = {
  // 基础工具
  callCloudFunction,
  getToken,
  getUserInfo,
  checkCloudInit,
  showLoading,
  hideLoading,
  showError,
  showSuccess,

  // 认证相关
  login,

  // 用户相关
  getUserProfile,
  updateUserResources,
  updatePrivacySetting,
  updateUserLocation,

  // 求助相关
  createHelpRequest,
  getHelpRequestStatus,
  cancelHelpRequest,
  completeHelp,

  // 附近用户
  getNearbyUsers,

  // 联系相关
  contactUser,

  // 情绪支持
  emotionSupport
};
