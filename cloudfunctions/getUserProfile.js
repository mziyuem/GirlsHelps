// 云函数：获取用户资料
// 根据token获取用户的完整资料

const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 验证token并获取用户ID
async function validateTokenAndGetUserId(token) {
  if (!token) {
    throw new Error('缺少访问令牌');
  }

  // 从token中提取用户ID (格式: token_{userId}_{timestamp}_{random})
  const parts = token.split('_');
  if (parts.length < 4 || parts[0] !== 'token') {
    throw new Error('无效的访问令牌');
  }

  const userId = `user_${parts[1]}_${parts[2]}`;

  // 验证用户是否存在
  const userQuery = await db.collection('users').where({
    userId: userId
  }).get();

  if (userQuery.data.length === 0) {
    throw new Error('用户不存在');
  }

  return userId;
}

// 计算加入天数
function calculateJoinDays(joinTime) {
  if (!joinTime) return 0;

  const joinDate = new Date(joinTime);
  const now = new Date();
  const diffTime = now.getTime() - joinDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

exports.main = async (event, context) => {
  const { token } = event;

  try {
    console.log('开始获取用户资料');

    // 验证token并获取用户ID
    const userId = await validateTokenAndGetUserId(token);

    // 获取用户完整信息
    const userQuery = await db.collection('users').where({
      userId: userId
    }).get();

    if (userQuery.data.length === 0) {
      return {
        success: false,
        error: '用户不存在'
      };
    }

    const user = userQuery.data[0];

    // 计算加入天数
    const joinDays = calculateJoinDays(user.joinTime);

    console.log('获取用户资料成功:', userId);

    return {
      success: true,
      user: {
        userId: user.userId,
        nickName: user.nickName,
        avatarUrl: user.avatarUrl || '',
        resources: user.resources || [],
        showOnMap: user.showOnMap !== false,
        stats: user.stats || { helpGiven: 0, helpReceived: 0 },
        joinDays: joinDays,
        joinTime: user.joinTime,
        privacyOffset: user.privacyOffset || 200
      }
    };

  } catch (error) {
    console.error('获取用户资料失败:', error);
    return {
      success: false,
      error: error.message || '获取用户资料失败'
    };
  }
};
