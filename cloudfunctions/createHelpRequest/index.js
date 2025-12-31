// cloudfunctions/createHelpRequest/index.js
// Creating help request cloud function with broadcast notification

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 订阅消息模板ID
// 模板关键词：作者、发布时间、备注、发布标题
const SUBSCRIBE_MESSAGE_TEMPLATE_ID = '7ugkaeDHRleeeT0peCAbcTQv1dSboyU3AWTWaexoSuQ';

/**
 * Generate request ID
 */
function generateRequestId() {
  return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * 计算两点之间的距离（单位：km）
 * 使用 Haversine 公式
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // 地球半径（km）
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * Math.PI / 180;
}

/**
 * 匹配帮助类型到资源名称
 */
function getResourceType(type) {
  const typeMap = {
    'pad': '卫生巾',
    'tissue': '纸巾',
    'safety': '安全陪伴',
    'other': '其他急需'
  };
  return typeMap[type] || '急需物品';
}

/**
 * 截断字符串到指定长度
 * thing 类型限制 20 个字符
 */
function truncateThing(str, maxLength = 20) {
  if (!str) return '';
  // 计算中文字符为 2 个长度
  let len = 0;
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const charLen = /[\u4e00-\u9fa5]/.test(char) ? 2 : 1;
    if (len + charLen > maxLength) {
      break;
    }
    result += char;
    len += charLen;
  }
  return result || str.substring(0, maxLength);
}

/**
 * 发送订阅消息给用户
 * 模板字段名（从微信公众平台获取）：
 * - 作者: thing6
 * - 发布时间: time8
 * - 备注: thing11
 * - 发布标题: thing12
 */
async function sendSubscribeMessage(openid, requestData, distance) {
  try {
    // 截断备注到 20 字符（thing 类型限制）
    const note = truncateThing(requestData.note || '急需帮助', 20);

    const messageData = {
      touser: openid,
      templateId: SUBSCRIBE_MESSAGE_TEMPLATE_ID,
      page: 'pages/messages/index?requestId=' + requestData.requestId,
      data: {
        // 作者 - 距离信息
        thing6: {
          value: distance.toFixed(1) + 'km以内'
        },
        // 发布时间
        time8: {
          value: formatDate(new Date(requestData.createTime))
        },
        // 备注 - 补充说明（已截断到20字符）
        thing11: {
          value: note
        },
        // 发布标题 - 请求类型
        thing12: {
          value: '求助：' + getResourceType(requestData.type)
        }
      },
      miniprogramState: 'developer'
    };

    console.log('[SendSubscribeMessage] Sending with data:', {
      thing6: messageData.data.thing6.value,
      time8: messageData.data.time8.value,
      thing11: messageData.data.thing11.value,
      thing12: messageData.data.thing12.value
    });

    const result = await cloud.openapi.subscribeMessage.send(messageData);

    console.log('[SendSubscribeMessage] ✅ Success:', openid.substring(0, 15) + '...');
    return { success: true };

  } catch (err) {
    console.error('[SendSubscribeMessage] ❌ Error:', {
      openid: openid.substring(0, 15) + '...',
      errCode: err.errCode,
      errMsg: err.errMsg
    });

    // 详细错误处理
    if (err.errCode === 40037) {
      console.error('[SendSubscribeMessage] 模板ID不存在');
      return { success: false, error: '模板ID不存在' };
    } else if (err.errCode === 43101) {
      console.error('[SendSubscribeMessage] 用户未订阅');
      return { success: false, notSubscribed: true };
    } else if (err.errCode === 47003) {
      console.error('[SendSubscribeMessage] 模板字段值不正确');
      return { success: false, error: '模板字段值不正确' };
    } else if (err.errCode === 20004) {
      console.error('[SendSubscribeMessage] 模板参数格式错误');
      return { success: false, error: '模板参数格式错误' };
    }

    return { success: false, error: err.errMsg };
  }
}

/**
 * 格式化日期
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

/**
 * 广播请求给附近符合条件的用户
 * 暂时修改为：通知所有有资源的用户（不筛选距离和资源类型）
 */
async function broadcastToNearbyUsers(requestId, requestData) {
  try {
    console.log('[Broadcast] Starting broadcast for request:', requestId);
    console.log('[Broadcast] Request details:', {
      type: requestData.type,
      note: requestData.note,
      location: requestData.location
    });

    // 获取所有有资源的用户（暂时不筛选距离）
    const allUsersResult = await db.collection('users').where({
      showOnMap: true,
      openid: _.neq(requestData.openid), // 排除请求者自己
      'resources': _.exists(true).and(_.neq([])) // 有资源的用户
    }).get();

    console.log('[Broadcast] Total candidates found:', allUsersResult.data.length);

    if (allUsersResult.data.length === 0) {
      console.log('[Broadcast] No candidates found');
      return { notified: 0 };
    }

    // 打印所有候选用户的信息
    allUsersResult.data.forEach((user, idx) => {
      console.log(`[Broadcast] Candidate ${idx + 1}:`, {
        openid: user.openid.substring(0, 15) + '...',
        nickname: user.nickname,
        resources: user.resources
      });
    });

    // 暂时不过滤，所有有资源的用户都通知
    const matchedUsers = [];

    for (const user of allUsersResult.data) {
      if (!user.resources || user.resources.length === 0) {
        continue;
      }

      matchedUsers.push({
        openid: user.openid,
        userId: user.userId,
        nickname: user.nickname || '匿名用户',
        distance: 0 // 暂时不计算距离
      });
    }

    console.log('[Broadcast] Will notify', matchedUsers.length, 'users');

    if (matchedUsers.length === 0) {
      console.log('[Broadcast] No matched users within 15km');
      return { notified: 0 };
    }

    // 发送订阅消息推送
    let successCount = 0;
    let failCount = 0;

    for (const helper of matchedUsers) {
      console.log('[Broadcast] Sending to:', helper.nickname, 'openid:', helper.openid.substring(0, 15) + '...');

      const result = await sendSubscribeMessage(
        helper.openid,
        requestData,
        helper.distance || 0.1 // 避免距离为0
      );

      if (result.success) {
        successCount++;
        console.log('[Broadcast] ✅ Notification sent to:', helper.nickname);
      } else if (result.notSubscribed) {
        failCount++;
        console.log('[Broadcast] ⚠️ User not subscribed:', helper.nickname);
      } else {
        failCount++;
        console.log('[Broadcast] ❌ Failed to send to:', helper.nickname, result.error);
      }
    }

    console.log('[Broadcast] Complete - Success:', successCount, 'Failed:', failCount);

    // 更新请求记录，记录已通知的用户
    await db.collection('help_requests').where({
      requestId: requestId
    }).update({
      data: {
        notifiedUsers: matchedUsers.map(u => u.userId),
        notifiedCount: successCount
      }
    });

    return {
      notified: successCount,
      failed: failCount,
      total: matchedUsers.length
    };

  } catch (err) {
    console.error('[Broadcast] Error:', err);
    return { notified: 0, error: err.message };
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { token, type, note, location } = event;

  console.log('[CreateHelpRequest] Request:', {
    openid: wxContext.OPENID,
    type: type,
    note: note,
    location: location
  });

  try {
    // Get user info
    const userResult = await db.collection('users').where({
      openid: wxContext.OPENID
    }).get();

    if (userResult.data.length === 0) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    const user = userResult.data[0];

    // Check if there's an active request
    const activeRequestResult = await db.collection('help_requests').where({
      openid: wxContext.OPENID,
      status: _.in(['pending', 'matched', 'active'])
    }).get();

    // If there's an active request, cancel it first
    if (activeRequestResult.data.length > 0) {
      const oldRequestId = activeRequestResult.data[0].requestId;
      console.log('[CreateHelpRequest] Cancelling old request:', oldRequestId);

      await db.collection('help_requests').where({
        requestId: oldRequestId
      }).update({
        data: {
          status: 'cancelled',
          cancelTime: new Date(),
          cancelReason: 'Auto-cancelled by new request'
        }
      });

      console.log('[CreateHelpRequest] Old request cancelled:', oldRequestId);
    }

    const now = new Date();
    const requestId = generateRequestId();

    // Create help request
    const requestData = {
      openid: wxContext.OPENID,
      userId: user.userId,
      requestId: requestId,
      type: type || 'other',
      note: note || '',
      status: 'pending',
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy || 0
      },
      matchedUsers: [],
      notifiedUsers: [],
      notifiedCount: 0,
      activeHelperId: null,
      createTime: now,
      matchTime: null,
      completeTime: null,
      expireTime: new Date(now.getTime() + 30 * 60 * 1000), // Expires in 30 minutes
      cancelTime: null
    };

    const addResult = await db.collection('help_requests').add({
      data: requestData
    });

    console.log('[CreateHelpRequest] Request created:', requestId);

    // 立即广播给附近符合条件的用户
    const broadcastResult = await broadcastToNearbyUsers(requestId, {
      ...requestData,
      createTime: now
    });

    console.log('[CreateHelpRequest] Broadcast result:', broadcastResult);

    return {
      success: true,
      requestId: requestId,
      status: 'pending',
      notified: broadcastResult.notified,
      message: broadcastResult.notified > 0
        ? `已通知${broadcastResult.notified}位附近可提供帮助的姐妹`
        : '正在寻找附近的帮助者'
    };

  } catch (err) {
    console.error('[CreateHelpRequest] Error:', err);
    return {
      success: false,
      error: err.message || 'Failed to create help request'
    };
  }
};
