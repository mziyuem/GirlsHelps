// cloudfunctions/updateUserLocation/index.js
// 更新用户位置云函数

const cloud = require('wx-server-sdk');

cloud.init({
  env: 'cloud1-8ggz6j81c4d33fbe'
});

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { token, location } = event;

  console.log('[UpdateUserLocation] Request:', {
    openid: wxContext.OPENID,
    location: location
  });

  try {
    // 更新用户位置
    const locationData = {
      currentLocation: {
        latitude: Number(location.latitude), // 强制转数值
        longitude: Number(location.longitude), // 强制转数值
        accuracy: Number(location.accuracy) || 0, // 强制转数值
        updateTime: db.serverDate() // 替换为云端时间，避免本地时间偏差
      },
      lastActiveTime: db.serverDate()
    };

    const result = await db.collection('users').doc(wxContext.OPENID).update({
      data: locationData // 移除 merge 参数，update 天然支持增量更新
    });

    console.log('[UpdateUserLocation] Updated, stats:', result.stats);
    
    if (result.stats.updated === 0) {
      await db.collection('users').doc(wxContext.OPENID).set({
        data: {
          // 基础字段（避免空文档）
          openid: wxContext.OPENID,
          createTime: db.serverDate(),
          // 位置字段
          ...locationData
        }
      });
      console.log('[UpdateUserLocation] Created new user document');
    }

    return {
      success: true
    };

  } catch (err) {
    console.error('[UpdateUserLocation] Error:', err);
    return {
      success: false,
      error: err.message || '更新位置失败'
    };
  }
};
