// 云函数：完成互助
// 标记求助请求为已完成，更新统计信息

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
    console.log('开始完成互助:', requestId);

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
      userId: userId // 确保只能完成自己的请求
    }).get();

    if (requestQuery.data.length === 0) {
      return {
        success: false,
        error: '请求不存在或无权限完成'
      };
    }

    const request = requestQuery.data[0];

    // 检查状态是否可以完成
    if (request.status !== 'active') {
      return {
        success: false,
        error: `当前状态(${request.status})无法完成`
      };
    }

    const now = new Date();

    // 更新请求状态
    await db.collection('help_requests').doc(request._id).update({
      data: {
        status: 'completed',
        completeTime: now
      }
    });

    // 更新相关会话状态
    if (request.activeHelperId) {
      await db.collection('help_sessions').where({
        requestId: requestId,
        status: 'active'
      }).update({
        data: {
          status: 'completed',
          completeTime: now
        }
      });

      // 更新帮助者的统计信息
      await db.collection('users').where({
        userId: request.activeHelperId
      }).update({
        data: {
          'stats.helpGiven': db.command.inc(1)
        }
      });
    }

    // 更新求助者的统计信息
    await db.collection('users').where({
      userId: userId
    }).update({
      data: {
        'stats.helpReceived': db.command.inc(1)
      }
    });

    console.log('互助完成成功:', requestId);

    return {
      success: true,
      message: '互助已完成，感谢您的使用',
      requestId: requestId
    };

  } catch (error) {
    console.error('完成互助失败:', error);
    return {
      success: false,
      error: error.message || '完成互助失败，请稍后重试'
    };
  }
};
