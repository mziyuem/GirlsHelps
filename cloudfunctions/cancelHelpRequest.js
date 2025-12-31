// 云函数：取消求助请求
// 取消指定的求助请求

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
    console.log('开始取消求助请求:', requestId);

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
      userId: userId // 确保只能取消自己的请求
    }).get();

    if (requestQuery.data.length === 0) {
      return {
        success: false,
        error: '请求不存在或无权限取消'
      };
    }

    const request = requestQuery.data[0];

    // 检查状态是否可以取消
    const cancellableStatuses = ['pending', 'matched', 'active'];
    if (!cancellableStatuses.includes(request.status)) {
      return {
        success: false,
        error: `当前状态(${request.status})无法取消`
      };
    }

    // 更新请求状态
    await db.collection('help_requests').doc(request._id).update({
      data: {
        status: 'cancelled',
        cancelTime: new Date()
      }
    });

    // 如果有活跃的帮助者，需要关闭相关的会话
    if (request.activeHelperId) {
      // 更新相关会话状态
      await db.collection('help_sessions').where({
        requestId: requestId,
        status: 'active'
      }).update({
        data: {
          status: 'cancelled',
          completeTime: new Date()
        }
      });
    }

    console.log('求助请求取消成功:', requestId);

    return {
      success: true,
      message: '请求已取消',
      requestId: requestId
    };

  } catch (error) {
    console.error('取消求助请求失败:', error);
    return {
      success: false,
      error: error.message || '取消请求失败，请稍后重试'
    };
  }
};
