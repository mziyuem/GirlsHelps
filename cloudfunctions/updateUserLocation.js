// 云函数：更新用户位置
// 更新用户的当前位置信息

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

// 创建地理位置点
function createGeoPoint(location) {
  return {
    type: 'Point',
    coordinates: [location.longitude, location.latitude] // MongoDB GeoJSON格式：[经度, 纬度]
  };
}

exports.main = async (event, context) => {
  const { token, location } = event;

  try {
    console.log('开始更新用户位置:', location);

    // 参数校验
    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      return {
        success: false,
        error: '位置信息不完整'
      };
    }

    // 验证经纬度范围
    if (location.latitude < -90 || location.latitude > 90 ||
        location.longitude < -180 || location.longitude > 180) {
      return {
        success: false,
        error: '无效的经纬度坐标'
      };
    }

    // 验证token并获取用户ID
    const userId = await validateTokenAndGetUserId(token);

    // 准备位置数据
    const locationData = {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy || 0,
      updateTime: new Date()
    };

    // 创建地理位置索引数据
    const geoLocation = createGeoPoint(location);

    // 更新用户位置
    await db.collection('users').where({
      userId: userId
    }).update({
      data: {
        currentLocation: locationData,
        // 同时更新地理位置索引字段（如果需要）
        location: geoLocation
      }
    });

    console.log('用户位置更新成功:', userId);

    return {
      success: true,
      message: '位置更新成功',
      location: locationData
    };

  } catch (error) {
    console.error('更新用户位置失败:', error);
    return {
      success: false,
      error: error.message || '位置更新失败，请稍后重试'
    };
  }
};
