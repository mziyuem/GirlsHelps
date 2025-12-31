// cloudfunctions/login/index.js
// 微信登录云函数

const cloud = require('wx-server-sdk');

cloud.init({
  env: 'cloud1-8ggz6j81c4d33fbe'
});

const db = cloud.database();
const _ = db.command;

/**
 * 生成用户唯一ID
 */
function generateUserId() {
  return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * 生成token
 */
function generateToken(openid) {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substr(2, 16);
  return Buffer.from(openid + ':' + timestamp + ':' + randomStr).toString('base64');
}

/**
 * 计算加入天数
 */
function calculateJoinDays(joinTime) {
  if (!joinTime) return 0;
  const now = new Date();
  const join = new Date(joinTime);
  const diffTime = Math.abs(now - join);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { code, userInfo } = event;

  console.log('[Login] Request:', {
    openid: wxContext.OPENID,
    userInfo: userInfo,
    userInfoKeys: userInfo ? Object.keys(userInfo) : []
  });

  try {
    // 检查openid是否存在
    if (!wxContext.OPENID) {
      console.error('[Login] No OPENID in context:', wxContext);
      return {
        success: false,
        error: '无法获取用户身份信息'
      };
    }

    console.log('[Login] Login attempt with openid:', wxContext.OPENID);

    // 使用where查询更安全，避免直接使用doc().get()可能出现的异常
    const userQuery = await db.collection('users').where({
      openid: wxContext.OPENID
    }).get();

    console.log('[Login] User query result:', {
      found: userQuery.data.length > 0,
      openid: wxContext.OPENID,
      dataLength: userQuery.data.length
    });

    let user;
    let isNewUser = false;

    if (userQuery.data.length === 0) {
      // 新用户，创建记录
      isNewUser = true;
      const now = db.serverDate(); // 修改2：改用云端时间，避免本地时间偏差

      user = {
        openid: wxContext.OPENID, // 使用 openid 字段匹配数据库索引
        userId: generateUserId(),
        nickName: userInfo.nickName || '姐妹',
        resources: [],
        showOnMap: true,
        stats: {
          helpGiven: 0,
          helpReceived: 0
        },
        currentLocation: {
          latitude: null,
          longitude: null,
          accuracy: 0,
          updateTime: null
        },
        privacyOffset: 200,
        joinTime: now
      };

      // 使用 add() 创建新用户，让云开发自动处理文档ID
      // 这样可以确保 _openid 字段被正确设置
      const addResult = await db.collection('users').add({
        data: user
      });

      user._id = addResult._id;
      console.log('[Login] New user created:', user.userId, 'document id:', user._id);

    } else {
      // 老用户，更新最后活跃时间
      user = userQuery.data[0];

      // 构建更新数据对象
      const updateData = {};

      // 仅更新有变化的用户信息，避免覆盖
      if (userInfo?.nickName && userInfo.nickName !== user.nickName) {
        updateData.nickName = userInfo.nickName;
      }

      // 只有当有数据需要更新时才执行更新操作
      if (Object.keys(updateData).length > 0) {
        await db.collection('users').where({
          openid: wxContext.OPENID
        }).update({
          data: updateData
        });

        console.log('[Login] Existing user updated:', user.userId, 'nickName:', userInfo.nickName);
      } else {
        console.log('[Login] Existing user, no update needed:', user.userId, 'nickName:', user.nickName);
      }
    }

    // 生成token
    const token = generateToken(wxContext.OPENID);

    // 计算加入天数
    const joinDays = calculateJoinDays(user.joinTime);

    return {
      success: true,
      token: token,
      userInfo: {
        userId: user.userId,
        nickName: user.nickName,
        resources: user.resources || [],
        showOnMap: user.showOnMap,
        stats: user.stats || { helpGiven: 0, helpReceived: 0 }
      },
      isNewUser: isNewUser
    };

  } catch (err) {
    console.error('[Login] Error:', err);
    return {
      success: false,
      error: err.message || '登录失败'
    };
  }
};
