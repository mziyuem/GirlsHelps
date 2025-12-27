// cloudfunctions/updateUserLocation/index.js
// 更新用户位置云函数

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
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
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy || 0,
        updateTime: new Date()
      },
      lastActiveTime: new Date()
    };

    const result = await db.collection('users').where({
      _openid: wxContext.OPENID
    }).update({
      data: locationData
    });

    console.log('[UpdateUserLocation] Updated, stats:', result.stats);

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
