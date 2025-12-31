// 云函数：获取会话详情
// 获取指定会话的详细信息

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

  const parts = token.split('_');
  if (parts.length < 4 || parts[0] !== 'token') {
    throw new Error('无效的访问令牌');
  }

  const userId = `user_${parts[1]}_${parts[2]}`;

  const userQuery = await db.collection('users').where({
    userId: userId
  }).get();

  if (userQuery.data.length === 0) {
    throw new Error('用户不存在');
  }

  return userId;
}

exports.main = async (event, context) => {
  const { token, sessionId } = event;

  try {
    console.log('开始获取会话详情:', sessionId);

    // 参数校验
    if (!sessionId) {
      return {
        success: false,
        error: '缺少会话ID'
      };
    }

    // 验证token并获取用户ID
    const userId = await validateTokenAndGetUserId(token);

    // 获取会话信息
    const sessionQuery = await db.collection('help_sessions').where({
      sessionId: sessionId,
      $or: [
        { seekerId: userId },
        { helperId: userId }
      ]
    }).get();

    if (sessionQuery.data.length === 0) {
      return {
        success: false,
        error: '会话不存在或无权限查看'
      };
    }

    const session = sessionQuery.data[0];

    // 获取对方用户信息
    const otherUserId = session.seekerId === userId ? session.helperId : session.seekerId;
    const otherUserQuery = await db.collection('users').where({
      userId: otherUserId
    }).get();

    const otherUser = otherUserQuery.data[0] || {};

    console.log('获取会话详情成功:', sessionId);

    return {
      success: true,
      session: {
        sessionId: session.sessionId,
        status: session.status,
        seekerId: session.seekerId,
        helperId: session.helperId,
        meetingPoint: session.meetingPoint || '',
        meetingTime: session.meetingTime,
        createTime: session.createTime,
        otherUser: {
          userId: otherUser.userId,
          nickName: otherUser.nickName || '姐妹'
        }
      }
    };

  } catch (error) {
    console.error('获取会话详情失败:', error);
    return {
      success: false,
      error: error.message || '获取会话详情失败，请稍后重试'
    };
  }
};
