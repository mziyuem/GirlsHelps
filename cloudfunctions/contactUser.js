// 云函数：联系用户
// 处理用户间的联系请求，创建互助会话

const cloud = require('wx-server-sdk';

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

// 生成会话ID
function generateSessionId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `session_${timestamp}_${random}`;
}

exports.main = async (event, context) => {
  const { token, targetUserId, type } = event;

  try {
    console.log('开始处理联系请求:', { targetUserId, type });

    // 参数校验
    if (!targetUserId) {
      return {
        success: false,
        error: '缺少目标用户ID'
      };
    }

    if (!type || !['help_request', 'help_offer'].includes(type)) {
      return {
        success: false,
        error: '无效的联系类型'
      };
    }

    // 验证token并获取用户ID
    const currentUserId = await validateTokenAndGetUserId(token);

    // 检查目标用户是否存在
    const targetUserQuery = await db.collection('users').where({
      userId: targetUserId
    }).get();

    if (targetUserQuery.data.length === 0) {
      return {
        success: false,
        error: '目标用户不存在'
      };
    }

    const targetUser = targetUserQuery.data[0];

    let requestId = null;
    let sessionPurpose = '';

    if (type === 'help_request') {
      // 当前用户想请求帮助（联系帮助者）
      sessionPurpose = '求助';

      // 检查是否有合适的求助请求
      const userRequests = await db.collection('help_requests').where({
        userId: currentUserId,
        status: db.command.in(['pending', 'matched'])
      }).get();

      if (userRequests.data.length === 0) {
        return {
          success: false,
          error: '您当前没有进行中的求助请求'
        };
      }

      requestId = userRequests.data[0].requestId;

    } else if (type === 'help_offer') {
      // 当前用户想提供帮助（联系求助者）
      sessionPurpose = '提供帮助';

      // 检查目标用户是否有求助请求
      const targetRequests = await db.collection('help_requests').where({
        userId: targetUserId,
        status: db.command.in(['pending', 'matched'])
      }).get();

      if (targetRequests.data.length === 0) {
        return {
          success: false,
          error: '该用户当前没有求助请求'
        };
      }

      requestId = targetRequests.data[0].requestId;
    }

    // 检查是否已存在会话
    const existingSession = await db.collection('help_sessions').where({
      requestId: requestId,
      $or: [
        { seekerId: currentUserId, helperId: targetUserId },
        { seekerId: targetUserId, helperId: currentUserId }
      ],
      status: 'active'
    }).get();

    if (existingSession.data.length > 0) {
      return {
        success: false,
        error: '已存在进行中的会话'
      };
    }

    // 创建新的会话
    const sessionId = generateSessionId();

    const sessionData = {
      sessionId: sessionId,
      requestId: requestId,
      seekerId: type === 'help_request' ? currentUserId : targetUserId,
      helperId: type === 'help_request' ? targetUserId : currentUserId,
      status: 'active',
      meetingPoint: '',
      meetingTime: null,
      messages: [],
      createTime: new Date(),
      completeTime: null
    };

    await db.collection('help_sessions').add({
      data: sessionData
    });

    // 更新求助请求状态
    if (requestId) {
      await db.collection('help_requests').where({
        requestId: requestId
      }).update({
        data: {
          status: 'active',
          activeHelperId: sessionData.helperId,
          matchTime: new Date()
        }
      });
    }

    console.log('联系请求处理成功:', { sessionId, type });

    return {
      success: true,
      message: '联系请求已发送',
      sessionId: sessionId,
      type: type
    };

  } catch (error) {
    console.error('联系用户失败:', error);
    return {
      success: false,
      error: error.message || '联系失败，请稍后重试'
    };
  }
};
