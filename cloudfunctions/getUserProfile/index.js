// cloudfunctions/getUserProfile/index.js
// 获取用户资料云函数

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

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
  const { token } = event;

  console.log('[GetUserProfile] Request:', {
    openid: wxContext.OPENID
  });

  try {
    // 获取用户信息
    const result = await db.collection('users').where({
      _openid: wxContext.OPENID
    }).get();

    if (result.data.length === 0) {
      return {
        success: false,
        error: '用户不存在'
      };
    }

    const user = result.data[0];
    const joinDays = calculateJoinDays(user.joinTime);

    console.log('[GetUserProfile] User found:', user.userId);

    return {
      success: true,
      user: {
        userId: user.userId,
        nickName: user.nickName,
        avatarUrl: user.avatarUrl || '',
        joinDays: joinDays,
        avatar: user.avatarUrl ? user.avatarUrl.substring(0, 1) : '👩🏻',
        resources: user.resources || [],
        showOnMap: user.showOnMap !== false, // 默认true
        stats: user.stats || {
          helpGiven: 0,
          helpReceived: 0
        },
        isAnonymous: user.isAnonymous || false
      }
    };

  } catch (err) {
    console.error('[GetUserProfile] Error:', err);
    return {
      success: false,
      error: err.message || '获取用户资料失败'
    };
  }
};
