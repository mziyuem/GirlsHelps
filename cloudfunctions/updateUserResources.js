// 云函数：更新用户资源
// 更新用户可提供的资源列表

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
  const { token, resources } = event;

  try {
    console.log('开始更新用户资源:', resources);

    // 参数校验
    if (!Array.isArray(resources)) {
      return {
        success: false,
        error: '资源参数必须是数组'
      };
    }

    // 验证资源有效性
    const validResources = ['卫生巾', '纸巾', '暖宝宝', '热水', '充电宝', '巧克力', '雨伞', '充电线'];
    const invalidResources = resources.filter(r => !validResources.includes(r));

    if (invalidResources.length > 0) {
      return {
        success: false,
        error: `包含无效资源: ${invalidResources.join(', ')}`
      };
    }

    // 验证token并获取用户ID
    const userId = await validateTokenAndGetUserId(token);

    // 更新用户资源
    await db.collection('users').where({
      userId: userId
    }).update({
      data: {
        resources: resources
      }
    });

    console.log('用户资源更新成功:', userId);

    return {
      success: true,
      message: '资源更新成功',
      resources: resources
    };

  } catch (error) {
    console.error('更新用户资源失败:', error);
    return {
      success: false,
      error: error.message || '更新失败，请稍后重试'
    };
  }
};
