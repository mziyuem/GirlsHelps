// cloudfunctions/updateUserResources/index.js
// 更新用户资源云函数

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { token, resources } = event;

  console.log('[UpdateUserResources] Request:', {
    openid: wxContext.OPENID,
    resources: resources
  });

  try {
    // 使用where条件更新，避免文档ID问题
    const result = await db.collection('users').where({
      openid: wxContext.OPENID
    }).update({
      data: {
        resources: resources || []
      }
    });

    console.log('[UpdateUserResources] Updated, stats:', result.stats);

    return {
      success: true,
      message: '资源已更新'
    };

  } catch (err) {
    console.error('[UpdateUserResources] Error:', err);
    return {
      success: false,
      error: err.message || '更新资源失败'
    };
  }
};
