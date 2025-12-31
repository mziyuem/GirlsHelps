// 云函数：设置见面信息
// 设置会话中的见面地点和时间

const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

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
  const { token, sessionId, meetingPoint, meetingTime } = event;

  try {
    console.log('开始设置见面信息:', { sessionId, meetingPoint });

    // 参数校验
    if (!sessionId) {
      return {
        success: false,
        error: '缺少会话ID'
      };
    }

    if (!meetingPoint || meetingPoint.trim().length === 0) {
      return {
        success: false,
        error: '见面地点不能为空'
      };
    }

    if (meetingPoint.length > 100) {
      return {
        success: false,
        error: '见面地点描述过长，请控制在100字以内'
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

    // 准备更新数据
    const updateData = {
      meetingPoint: meetingPoint.trim()
    };

    if (meetingTime) {
      // 验证时间格式
      const timeDate = new Date(meetingTime);
      if (isNaN(timeDate.getTime())) {
        return {
          success: false,
          error: '无效的见面时间格式'
        };
      }
      updateData.meetingTime = timeDate;
    }

    // 更新会话信息并添加系统消息
    const systemMessage = {
      fromUserId: 'system',
      content: `设置见面地点：${meetingPoint.trim()}`,
      type: 'system',
      createTime: new Date()
    };

    await db.collection('help_sessions').where({
      sessionId: sessionId
    }).update({
      data: {
        ...updateData,
        messages: db.command.push(systemMessage)
      }
    });

    console.log('设置见面信息成功:', sessionId);

    return {
      success: true,
      meetingPoint: meetingPoint.trim(),
      meetingTime: updateData.meetingTime
    };

  } catch (error) {
    console.error('设置见面信息失败:', error);
    return {
      success: false,
      error: error.message || '设置见面信息失败，请稍后重试'
    };
  }
};
