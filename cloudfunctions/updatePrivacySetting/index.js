// cloudfunctions/updatePrivacySetting/index.js
// 更新隐私设置云函数

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { token, showOnMap } = event;

  console.log('[UpdatePrivacySetting] Request:', {
    openid: wxContext.OPENID,
    showOnMap: showOnMap
  });

  try {
    // 使用where条件更新，避免文档ID问题
    const result = await db.collection('users').where({
      openid: wxContext.OPENID
    }).update({
      data: {
        showOnMap: showOnMap !== false
      }
    });

    console.log('[UpdatePrivacySetting] Updated, stats:', result.stats);

    return {
      success: true,
      showOnMap: showOnMap !== false
    };

  } catch (err) {
    console.error('[UpdatePrivacySetting] Error:', err);
    return {
      success: false,
      error: err.message || '更新设置失败'
    };
  }
};
