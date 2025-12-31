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
    // 使用where查询更安全
    const userQuery = await db.collection('users').where({
      openid: wxContext.OPENID
    }).get();

    console.log('[GetUserProfile] Query result:', {
      found: userQuery.data.length > 0,
      openid: wxContext.OPENID
    });

    if (userQuery.data.length === 0) {
      console.error('[GetUserProfile] User not found with openid:', wxContext.OPENID);
      return {
        success: false,
        error: '用户不存在，openid: ' + wxContext.OPENID
      };
    }

    const user = userQuery.data[0];
    const joinDays = calculateJoinDays(user.joinTime);

    console.log('[GetUserProfile] User data:', {
      userId: user.userId,
      nickName: user.nickName,
      ip: user.ip,
      hasNickName: !!user.nickName,
      hasIp: !!user.ip
    });

    return {
      success: true,
      user: {
        userId: user.userId,
        nickName: user.nickName || '姐妹',
        ip: user.ip || '',
        resources: user.resources || [],
        showOnMap: user.showOnMap !== false,
        stats: user.stats || {
          helpGiven: 0,
          helpReceived: 0
        }
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
