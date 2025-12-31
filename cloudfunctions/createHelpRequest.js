// 云函数：创建求助请求
// 创建新的求助请求并推送给附近用户

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

// 生成请求ID
function generateRequestId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `req_${timestamp}_${random}`;
}

// 创建地理位置点
function createGeoPoint(location) {
  return {
    type: 'Point',
    coordinates: [location.longitude, location.latitude] // MongoDB GeoJSON格式：[经度, 纬度]
  };
}

// 获取附近用户（10公里范围内）
async function getNearbyUsers(location, excludeUserId) {
  try {
    const result = await db.collection('users')
      .where({
        // 使用地理位置查询
        location: db.command.geoNear({
          geometry: createGeoPoint(location),
          maxDistance: 10000, // 10公里
          minDistance: 0
        }),
        // 排除自己
        userId: db.command.neq(excludeUserId),
        // 只推送给愿意在地图上显示的用户
        showOnMap: true
      })
      .limit(50) // 限制推送数量
      .get();

    return result.data;
  } catch (error) {
    console.error('获取附近用户失败:', error);
    return [];
  }
}

// 发送小程序推送消息
async function sendPushMessage(openid, requestData) {
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId: 'YOUR_TEMPLATE_ID', // 需要在微信公众平台申请模板消息
      data: {
        thing1: {
          value: requestData.typeText
        },
        thing2: {
          value: '附近有人需要帮助'
        },
        time3: {
          value: new Date().toLocaleString()
        }
      },
      miniprogramState: 'trial' // 或者 'formal'
    });
    console.log('推送消息发送成功:', openid);
  } catch (error) {
    console.error('推送消息发送失败:', error);
    // 推送失败不影响主流程
  }
}

exports.main = async (event, context) => {
  const { token, type, note, location } = event;

  try {
    console.log('开始创建求助请求:', { type, note, location });

    // 参数校验
    if (!type) {
      return {
        success: false,
        error: '求助类型不能为空'
      };
    }

    const validTypes = ['pad', 'tissue', 'safety', 'emotion', 'other'];
    if (!validTypes.includes(type)) {
      return {
        success: false,
        error: '无效的求助类型'
      };
    }

    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      return {
        success: false,
        error: '位置信息不完整'
      };
    }

    // 验证token并获取用户ID
    const userId = await validateTokenAndGetUserId(token);

    // 检查用户是否已有进行中的请求
    const existingRequest = await db.collection('help_requests').where({
      userId: userId,
      status: db.command.in(['pending', 'matched', 'active'])
    }).get();

    if (existingRequest.data.length > 0) {
      return {
        success: false,
        error: '您已有进行中的求助请求，请先完成或取消后再发起新请求'
      };
    }

    // 获取用户信息
    const userQuery = await db.collection('users').where({
      userId: userId
    }).get();

    const user = userQuery.data[0];

    // 生成请求ID
    const requestId = generateRequestId();

    // 类型映射
    const typeMapping = {
      'pad': '卫生巾',
      'tissue': '纸巾',
      'safety': '安全陪伴',
      'emotion': '情绪支持',
      'other': '其他帮助'
    };

    // 创建求助请求
    const requestData = {
      _openid: user.openid,
      userId: userId,
      requestId: requestId,
      type: type,
      typeText: typeMapping[type],
      note: note || '',
      status: 'pending',
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy || 0
      },
      geoLocation: createGeoPoint(location), // 地理位置索引
      matchedUsers: [],
      activeHelperId: null,
      createTime: new Date(),
      expireTime: new Date(Date.now() + 30 * 60 * 1000), // 30分钟后过期
      cancelTime: null,
      completeTime: null
    };

    await db.collection('help_requests').add({
      data: requestData
    });

    // 获取附近用户并推送
    const nearbyUsers = await getNearbyUsers(location, userId);

    console.log(`找到 ${nearbyUsers.length} 个附近用户`);

    // 异步推送消息（不阻塞主流程）
    if (nearbyUsers.length > 0) {
      // 更新请求状态为已推送
      await db.collection('help_requests').where({
        requestId: requestId
      }).update({
        data: {
          matchedUsers: nearbyUsers.map(u => u.userId),
          status: 'pending'
        }
      });

      // 发送推送消息
      for (const nearbyUser of nearbyUsers.slice(0, 10)) { // 限制推送数量
        if (nearbyUser.openid) {
          sendPushMessage(nearbyUser.openid, requestData);
        }
      }
    }

    console.log('求助请求创建成功:', requestId);

    return {
      success: true,
      message: '求助请求已发送',
      requestId: requestId,
      nearbyUsersCount: nearbyUsers.length
    };

  } catch (error) {
    console.error('创建求助请求失败:', error);
    return {
      success: false,
      error: error.message || '创建求助请求失败，请稍后重试'
    };
  }
};
