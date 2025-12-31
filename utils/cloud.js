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

/**
 * 获取默认头像URL
 */
function getDefaultAvatar() {
  return 'https://mmbiz.qpic.cn/mmbiz_png/9c9Ricia1VibYibiaI4Y4a9Q4I4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y4Y/0?wx_fmt=png';
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
 * 更新用户信息
 * @param {object} userInfo 用户信息对象
 */
function updateUserInfo(userInfo) {
  return callCloudFunction('updateUserInfo', {
    token: getToken(),
    ...userInfo
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
 * @param {string} resource 资源类型（可选）
 */
function contactUser(targetUserId, type, resource) {
  showLoading('发送中...');
  const data = {
    token: getToken(),
    targetUserId: targetUserId,
    type: type
  };
  if (resource) {
    data.resource = resource;
  }
  return callCloudFunction('contactUser', data).finally(() => hideLoading());
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

// ==================== 会话相关 ====================

/**
 * 获取会话详情
 * @param {string} sessionId 会话ID
 */
function getSessionDetail(sessionId) {
  return callCloudFunction('getSessionDetail', {
    token: getToken(),
    sessionId: sessionId
  });
}

/**
 * 获取会话消息
 * @param {string} sessionId 会话ID
 */
function getSessionMessages(sessionId) {
  return callCloudFunction('getSessionMessages', {
    token: getToken(),
    sessionId: sessionId
  });
}

/**
 * 发送会话消息
 * @param {string} sessionId 会话ID
 * @param {string} content 消息内容
 * @param {string} type 消息类型
 */
function sendSessionMessage(sessionId, content, type = 'text') {
  showLoading('发送中...');
  return callCloudFunction('sendSessionMessage', {
    token: getToken(),
    sessionId: sessionId,
    content: content,
    type: type
  }).finally(() => hideLoading());
}

/**
 * 设置见面信息
 * @param {string} sessionId 会话ID
 * @param {string} meetingPoint 见面地点
 * @param {Date} meetingTime 见面时间
 */
function setMeetingInfo(sessionId, meetingPoint, meetingTime = null) {
  showLoading('设置中...');
  return callCloudFunction('setMeetingInfo', {
    token: getToken(),
    sessionId: sessionId,
    meetingPoint: meetingPoint,
    meetingTime: meetingTime
  }).finally(() => hideLoading());
}

/**
 * 完成会话
 * @param {string} sessionId 会话ID
 */
function completeSession(sessionId) {
  showLoading('完成中...');
  return callCloudFunction('completeSession', {
    token: getToken(),
    sessionId: sessionId
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
  getDefaultAvatar,

  // 认证相关
  login,

  // 用户相关
  getUserProfile,
  updateUserInfo,
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
  emotionSupport,

  // 会话相关
  getSessionDetail,
  getSessionMessages,
  sendSessionMessage,
  setMeetingInfo,
  completeSession
};
