// 云函数：获取会话消息
// 获取指定会话的所有消息记录

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
  const { token, sessionId, limit = 50 } = event;

  try {
    console.log('开始获取会话消息:', sessionId);

    // 参数校验
    if (!sessionId) {
      return {
        success: false,
        error: '缺少会话ID'
      };
    }

    // 验证token并获取用户ID
    const userId = await validateTokenAndGetUserId(token);

    // 验证用户是否属于该会话
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

    // 获取会话详情及消息
    const sessionResult = await db.collection('help_sessions').where({
      sessionId: sessionId
    }).get();

    if (sessionResult.data.length === 0) {
      return {
        success: false,
        error: '会话不存在'
      };
    }

    const session = sessionResult.data[0];
    const messages = (session.messages || [])
      .sort((a, b) => new Date(a.createTime) - new Date(b.createTime))
      .slice(-limit); // 获取最新的limit条消息

    console.log(`获取会话消息成功，共 ${messages.length} 条消息`);

    return {
      success: true,
      messages: messages,
      total: messages.length
    };

  } catch (error) {
    console.error('获取会话消息失败:', error);
    return {
      success: false,
      error: error.message || '获取消息失败，请稍后重试'
    };
  }
};
