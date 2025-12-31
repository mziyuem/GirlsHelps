// 云函数：发送会话消息
// 在指定会话中发送消息

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

// 生成消息ID
function generateMessageId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `msg_${timestamp}_${random}`;
}

exports.main = async (event, context) => {
  const { token, sessionId, content, type = 'text' } = event;

  try {
    console.log('开始发送会话消息:', { sessionId, type });

    // 参数校验
    if (!sessionId) {
      return {
        success: false,
        error: '缺少会话ID'
      };
    }

    if (!content || content.trim().length === 0) {
      return {
        success: false,
        error: '消息内容不能为空'
      };
    }

    if (content.length > 500) {
      return {
        success: false,
        error: '消息内容过长，请控制在500字以内'
      };
    }

    const validTypes = ['text', 'location', 'system'];
    if (!validTypes.includes(type)) {
      return {
        success: false,
        error: '无效的消息类型'
      };
    }

    // 验证token并获取用户ID
    const userId = await validateTokenAndGetUserId(token);

    // 验证用户是否属于该会话且会话状态正常
    const sessionQuery = await db.collection('help_sessions').where({
      sessionId: sessionId,
      $or: [
        { seekerId: userId },
        { helperId: userId }
      ],
      status: 'active'
    }).get();

    if (sessionQuery.data.length === 0) {
      return {
        success: false,
        error: '会话不存在、无权限或已结束'
      };
    }

    // 生成消息ID并添加到会话消息数组中
    const messageId = generateMessageId();
    const messageData = {
      fromUserId: userId,
      content: content.trim(),
      type: type,
      createTime: new Date()
    };

    // 使用数据库命令将消息添加到会话的messages数组中
    await db.collection('help_sessions').where({
      sessionId: sessionId
    }).update({
      data: {
        messages: db.command.push(messageData)
      }
    });

    console.log('发送会话消息成功:', messageId);

    return {
      success: true,
      messageId: messageId,
      message: messageData
    };

  } catch (error) {
    console.error('发送会话消息失败:', error);
    return {
      success: false,
      error: error.message || '发送消息失败，请稍后重试'
    };
  }
};
