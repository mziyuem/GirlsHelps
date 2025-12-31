// 云函数：完成会话
// 标记会话为已完成状态

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
    console.log('开始完成会话:', sessionId);

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
        error: '会话不存在或无权限操作'
      };
    }

    const session = sessionQuery.data[0];

    // 检查会话状态是否可以完成
    if (session.status !== 'active') {
      return {
        success: false,
        error: `当前会话状态(${session.status})无法完成`
      };
    }

    const now = new Date();

    // 更新会话状态
    await db.collection('help_sessions').doc(session._id).update({
      data: {
        status: 'completed',
        completeTime: now
      }
    });

    // 在会话中添加系统消息
    const systemMessage = {
      sessionId: sessionId,
      fromUserId: 'system',
      content: '互助已完成，感谢您的使用！',
      type: 'system',
      createTime: now
    };

    await db.collection('session_messages').add({
      data: systemMessage
    });

    console.log('完成会话成功:', sessionId);

    return {
      success: true,
      message: '互助已完成，感谢您的使用',
      sessionId: sessionId
    };

  } catch (error) {
    console.error('完成会话失败:', error);
    return {
      success: false,
      error: error.message || '完成会话失败，请稍后重试'
    };
  }
};
