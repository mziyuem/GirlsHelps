// 云函数：获取附近用户
// 获取指定位置附近的注册用户，用于地图显示

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
    coordinates: [location.longitude, location.latitude]
  };
}

// 计算两点间距离（米）
function calculateDistance(lat1, lng1, lat2, lng2) {
  const EARTH_RADIUS = 6371000; // 地球半径，单位米

  const radLat1 = lat1 * Math.PI / 180;
  const radLat2 = lat2 * Math.PI / 180;
  const a = radLat1 - radLat2;
  const b = (lng1 * Math.PI / 180) - (lng2 * Math.PI / 180);

  const s = 2 * Math.asin(Math.sqrt(Math.pow(Math.sin(a / 2), 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.pow(Math.sin(b / 2), 2)));
  const distance = s * EARTH_RADIUS;

  return Math.round(distance);
}

// 添加隐私保护的位置偏移
function addPrivacyOffset(location, offset) {
  // 简单的随机偏移（实际应用中可以使用更复杂的算法）
  const offsetLat = (Math.random() - 0.5) * 2 * offset / 111000; // 纬度偏移
  const offsetLng = (Math.random() - 0.5) * 2 * offset / 111000; // 经度偏移

  return {
    latitude: location.latitude + offsetLat,
    longitude: location.longitude + offsetLng
  };
}

exports.main = async (event, context) => {
  const { token, location, radius = 2000, limit = 20 } = event;

  try {
    console.log('开始获取附近用户:', { location, radius, limit });

    // 参数校验
    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      return {
        success: false,
        error: '位置信息不完整'
      };
    }

    if (radius > 10000) {
      return {
        success: false,
        error: '搜索半径不能超过10公里'
      };
    }

    // 验证token并获取用户ID
    const currentUserId = await validateTokenAndGetUserId(token);

    // 获取当前用户信息
    const currentUserQuery = await db.collection('users').where({
      userId: currentUserId
    }).get();

    const currentUser = currentUserQuery.data[0];
    const privacyOffset = currentUser.privacyOffset || 200;

    // 查询附近用户
    const nearbyUsersQuery = await db.collection('users')
      .where({
        // 使用地理位置查询
        location: db.command.geoNear({
          geometry: createGeoPoint(location),
          maxDistance: radius,
          minDistance: 0
        }),
        // 排除自己
        userId: db.command.neq(currentUserId),
        // 只显示愿意在地图上显示的用户
        showOnMap: true
      })
      .limit(limit * 2) // 多查询一些，用于后续处理
      .get();

    const users = [];

    for (const user of nearbyUsersQuery.data) {
      if (!user.currentLocation) continue;

      // 计算实际距离
      const distance = calculateDistance(
        location.latitude, location.longitude,
        user.currentLocation.latitude, user.currentLocation.longitude
      );

      // 应用隐私保护偏移
      const displayLocation = addPrivacyOffset(user.currentLocation, privacyOffset);

      // 确定用户类型和提供内容
      let userType = 'helper'; // helper: 可提供帮助, seeker: 正在求助
      let provide = '';
      let need = '';

      // 检查用户是否有可提供的资源
      if (user.resources && user.resources.length > 0) {
        provide = user.resources.join('、');
      }

      // 检查用户是否有进行中的求助请求
      const activeRequest = await db.collection('help_requests').where({
        userId: user.userId,
        status: db.command.in(['pending', 'matched', 'active'])
      }).get();

      if (activeRequest.data.length > 0) {
        userType = 'seeker';
        const request = activeRequest.data[0];
        need = request.typeText || request.type;

        // 求助者显示实际位置（但仍应用隐私偏移）
        displayLocation.latitude = user.currentLocation.latitude + (Math.random() - 0.5) * 2 * 50 / 111000; // 50米随机偏移
        displayLocation.longitude = user.currentLocation.longitude + (Math.random() - 0.5) * 2 * 50 / 111000;
      }

      users.push({
        userId: user.userId,
        nickName: user.nickName,
        type: userType,
        provide: provide,
        need: need,
        location: displayLocation,
        distance: distance,
        lastUpdate: user.currentLocation.updateTime
      });
    }

    // 按距离排序并限制数量
    users.sort((a, b) => a.distance - b.distance);
    const resultUsers = users.slice(0, limit);

    console.log(`获取附近用户成功，共找到 ${resultUsers.length} 个用户`);

    return {
      success: true,
      users: resultUsers,
      total: resultUsers.length,
      radius: radius
    };

  } catch (error) {
    console.error('获取附近用户失败:', error);
    return {
      success: false,
      error: error.message || '获取附近用户失败，请稍后重试'
    };
  }
};
