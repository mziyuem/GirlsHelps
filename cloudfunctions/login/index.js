// cloudfunctions/login/index.js
// 微信登录云函数

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
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
    userInfo: userInfo
  });

  try {
    // 检查用户是否存在
    const userResult = await db.collection('users').where({
      _openid: wxContext.OPENID
    }).get();

    let user;
    let isNewUser = false;

    if (userResult.data.length === 0) {
      // 新用户，创建记录
      isNewUser = true;
      const now = new Date();

      user = {
        _openid: wxContext.OPENID,
        userId: generateUserId(),
        nickName: userInfo.nickName || '姐妹',
        avatarUrl: userInfo.avatarUrl || '',
        isAnonymous: userInfo.isAnonymous || false,
        resources: [],
        showOnMap: true,
        stats: {
          helpGiven: 0,
          helpReceived: 0
        },
        currentLocation: null,
        privacyOffset: 200,
        joinTime: now,
        lastActiveTime: now,
        createTime: now
      };

      const addResult = await db.collection('users').add({
        data: user
      });

      user._id = addResult._id;
      console.log('[Login] New user created:', user.userId);

    } else {
      // 老用户，更新最后活跃时间
      user = userResult.data[0];
      const now = new Date();

      await db.collection('users').doc(user._id).update({
        data: {
          lastActiveTime: now,
          // 如果提供了新的用户信息，也更新
          ...(userInfo.nickName && { nickName: userInfo.nickName }),
          ...(userInfo.avatarUrl && { avatarUrl: userInfo.avatarUrl })
        }
      });

      user.lastActiveTime = now;
      console.log('[Login] Existing user:', user.userId);
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
        avatarUrl: user.avatarUrl,
        isAnonymous: user.isAnonymous,
        joinDays: joinDays,
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
