// 云函数：获取求助请求状态
// 获取指定求助请求的当前状态

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
  const { token, requestId } = event;

  try {
    console.log('开始获取求助请求状态:', requestId);

    // 参数校验
    if (!requestId) {
      return {
        success: false,
        error: '缺少请求ID'
      };
    }

    // 验证token并获取用户ID
    const userId = await validateTokenAndGetUserId(token);

    // 获取请求信息
    const requestQuery = await db.collection('help_requests').where({
      requestId: requestId,
      userId: userId // 确保只能查看自己的请求
    }).get();

    if (requestQuery.data.length === 0) {
      return {
        success: false,
        error: '请求不存在或无权限查看'
      };
    }

    const request = requestQuery.data[0];

    // 检查是否过期
    const now = new Date();
    if (request.expireTime && now > request.expireTime && request.status === 'pending') {
      // 更新状态为过期
      await db.collection('help_requests').doc(request._id).update({
        data: {
          status: 'expired'
        }
      });
      request.status = 'expired';
    }

    console.log('获取请求状态成功:', { requestId, status: request.status });

    return {
      success: true,
      status: request.status,
      request: {
        requestId: request.requestId,
        type: request.type,
        typeText: request.typeText,
        note: request.note,
        status: request.status,
        createTime: request.createTime,
        matchedUsersCount: request.matchedUsers ? request.matchedUsers.length : 0,
        activeHelperId: request.activeHelperId,
        expireTime: request.expireTime
      }
    };

  } catch (error) {
    console.error('获取求助请求状态失败:', error);
    return {
      success: false,
      error: error.message || '获取状态失败，请稍后重试'
    };
  }
};
