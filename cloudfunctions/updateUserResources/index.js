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
    // 更新用户资源
    const result = await db.collection('users').where({
      _openid: wxContext.OPENID
    }).update({
      data: {
        resources: resources || [],
        lastActiveTime: new Date()
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
