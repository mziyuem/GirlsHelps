// 云函数：更新隐私设置
// 更新用户是否在地图上显示的设置

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
  const { token, showOnMap } = event;

  try {
    console.log('开始更新隐私设置:', showOnMap);

    // 参数校验
    if (typeof showOnMap !== 'boolean') {
      return {
        success: false,
        error: 'showOnMap参数必须是布尔值'
      };
    }

    // 验证token并获取用户ID
    const userId = await validateTokenAndGetUserId(token);

    // 更新隐私设置
    await db.collection('users').where({
      userId: userId
    }).update({
      data: {
        showOnMap: showOnMap
      }
    });

    console.log('隐私设置更新成功:', userId);

    return {
      success: true,
      message: showOnMap ? '已开启地图显示' : '已关闭地图显示',
      showOnMap: showOnMap
    };

  } catch (error) {
    console.error('更新隐私设置失败:', error);
    return {
      success: false,
      error: error.message || '更新失败，请稍后重试'
    };
  }
};
