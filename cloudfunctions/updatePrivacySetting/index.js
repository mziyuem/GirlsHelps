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
    // 更新隐私设置
    const result = await db.collection('users').where({
      _openid: wxContext.OPENID
    }).update({
      data: {
        showOnMap: showOnMap !== false, // 确保是布尔值
        lastActiveTime: new Date()
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
