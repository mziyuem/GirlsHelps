// cloudfunctions/getNearbyUsers/index.js
// 获取附近用户云函数

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 计算两点之间的距离（米）
 * 使用 Haversine 公式
 */
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // 地球半径（米）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 位置模糊处理（保护隐私）
 * 在指定偏移量范围内随机偏移
 */
function blurLocation(lat, lon, offsetMeters) {
  const angle = Math.random() * Math.PI * 2;
  const offset = Math.random() * offsetMeters;

  // 1度约111km
  const dLat = (Math.sin(angle) * offset) / 111000;
  const dLon = (Math.cos(angle) * offset) / (111000 * Math.cos(lat * Math.PI / 180));

  return {
    latitude: lat + dLat,
    longitude: lon + dLon
  };
}

/**
 * 根据帮助类型返回中文标签
 */
function getTypeLabel(type) {
  const labels = {
    'pad': '卫生巾',
    'tissue': '纸巾',
    'safety': '安全陪伴',
    'other': '其他急需'
  };
  return labels[type] || '需要帮助';
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { token, location, radius = 2000, limit = 20 } = event;

  console.log('[GetNearbyUsers] Request:', {
    openid: wxContext.OPENID,
    location: location,
    radius: radius,
    limit: limit
  });

  try {
    // 获取所有有位置信息的用户
    const result = await db.collection('users').where({
      _openid: _.neq(wxContext.OPENID), // 排除自己
      showOnMap: true,
      currentLocation: _.exists(true)
    }).get();

    const users = [];
    const userLocation = {
      latitude: location.latitude,
      longitude: location.longitude
    };

    // 过滤距离内的用户
    for (const user of result.data) {
      if (!user.currentLocation || !user.currentLocation.latitude) {
        continue;
      }

      const distance = getDistance(
        userLocation.latitude,
        userLocation.longitude,
        user.currentLocation.latitude,
        user.currentLocation.longitude
      );

      if (distance <= radius) {
        // 位置模糊处理
        const blurredLocation = blurLocation(
          user.currentLocation.latitude,
          user.currentLocation.longitude,
          user.privacyOffset || 200
        );

        users.push({
          userId: user.userId,
          nickName: user.nickName,
          location: blurredLocation,
          distance: Math.floor(distance),
          resources: user.resources || [],
          // 判断用户类型：有资源的是帮助者
          type: (user.resources && user.resources.length > 0) ? 'helper' : 'seeker',
          provide: user.resources || [],
          avatarUrl: user.avatarUrl
        });
      }
    }

    // 按距离排序
    users.sort((a, b) => a.distance - b.distance);

    // 限制返回数量
    const limitedUsers = users.slice(0, limit);

    // 为返回数据添加更友好的格式
    const formattedUsers = limitedUsers.map(user => {
      const provide = user.type === 'helper' ? (user.provide[0] || '可提供帮助') : '';
      const need = user.type === 'seeker' ? '需要帮助' : '';

      return {
        userId: user.userId,
        nickName: user.nickName,
        type: user.type,
        location: user.location,
        distance: user.distance,
        provide: provide,
        need: need,
        resources: user.resources,
        avatarUrl: user.avatarUrl
      };
    });

    console.log('[GetNearbyUsers] Found users:', formattedUsers.length);

    return {
      success: true,
      users: formattedUsers,
      total: users.length
    };

  } catch (err) {
    console.error('[GetNearbyUsers] Error:', err);
    return {
      success: false,
      error: err.message || '获取附近用户失败',
      users: []
    };
  }
};
