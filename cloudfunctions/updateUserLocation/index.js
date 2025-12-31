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
    // ========== 修改1：增加参数校验（避免无效数据导致的写入失败） ==========
    if (!location || isNaN(Number(location.latitude)) || isNaN(Number(location.longitude))) {
      console.error('[UpdateUserLocation] Invalid location params:', location);
      return {
        success: false,
        error: '位置参数无效（经纬度必须为数字）'
      };
    }

    // 更新用户位置
    const locationData = {
      currentLocation: {
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        accuracy: Number(location.accuracy) || 0,
        updateTime: db.serverDate()
      }
    };

    // ========== 修改2：使用where条件更新，避免文档ID问题 ==========
    const result = await db.collection('users').where({
      openid: wxContext.OPENID
    }).update({
      data: locationData
    });

    console.log('[UpdateUserLocation] Updated, stats:', result.stats);
    
    // ========== 修改3：移除多余的 "更新为0则创建" 逻辑（set + merge: true 已兼容） ==========
    // 原逻辑多余：set({merge: true}) 本身会自动创建不存在的文档，无需额外判断
    // 若保留原逻辑，会导致 "创建文档" 日志重复，且可能触发重复写入

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
