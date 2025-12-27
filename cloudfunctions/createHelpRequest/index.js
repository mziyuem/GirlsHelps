// cloudfunctions/createHelpRequest/index.js
// 创建求助请求云函数

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 生成请求ID
 */
function generateRequestId() {
  return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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
    // 获取用户信息
    const userResult = await db.collection('users').where({
      _openid: wxContext.OPENID
    }).get();

    if (userResult.data.length === 0) {
      return {
        success: false,
        error: '用户不存在'
      };
    }

    const user = userResult.data[0];

    // 检查是否有进行中的请求
    const activeRequestResult = await db.collection('help_requests').where({
      _openid: wxContext.OPENID,
      status: _.in(['pending', 'matched', 'active'])
    }).get();

    if (activeRequestResult.data.length > 0) {
      return {
        success: false,
        error: '您有进行中的求助请求，请先完成或取消'
      };
    }

    const now = new Date();
    const requestId = generateRequestId();

    // 创建求助请求
    const requestData = {
      _openid: wxContext.OPENID,
      userId: user.userId,
      requestId: requestId,
      type: type,
      note: note || '',
      status: 'pending',
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy || 0
      },
      matchedHelperId: null,
      createTime: now,
      matchTime: null,
      completeTime: null,
      cancelTime: null
    };

    const addResult = await db.collection('help_requests').add({
      data: requestData
    });

    console.log('[CreateHelpRequest] Request created:', requestId);

    // 尝试匹配帮助者（这里简化处理，实际可以触发实时匹配）
    await matchHelpers(requestId, location, type);

    return {
      success: true,
      requestId: requestId,
      status: 'pending',
      estimatedTime: 5 // 预计5秒内匹配
    };

  } catch (err) {
    console.error('[CreateHelpRequest] Error:', err);
    return {
      success: false,
      error: err.message || '创建求助请求失败'
    };
  }
};

/**
 * 匹配帮助者（简化版：实际可以结合地理位置、资源等进行匹配）
 */
async function matchHelpers(requestId, location, type) {
  try {
    // 更新状态为已匹配（模拟匹配成功）
    // 实际应用中可以：1. 通知附近的帮助者 2. 等待帮助者响应 3. 使用定时任务检查状态

    // 这里简化处理：5秒后自动匹配成功（供测试使用）
    // 实际生产环境应该由帮助者主动响应

    setTimeout(async () => {
      try {
        // 查找附近的帮助者
        const helpers = await db.collection('users').where({
          showOnMap: true,
          'currentLocation.latitude': _.exists(true)
        }).limit(1).get();

        if (helpers.data.length > 0) {
          const helper = helpers.data[0];

          // 更新请求状态
          await db.collection('help_requests').where({
            requestId: requestId
          }).update({
            data: {
              status: 'matched',
              matchedHelperId: helper.userId,
              matchTime: new Date()
            }
          });

          console.log('[MatchHelpers] Request matched:', requestId);
        }
      } catch (err) {
        console.error('[MatchHelpers] Error:', err);
      }
    }, 5000);

  } catch (err) {
    console.error('[MatchHelpers] Init Error:', err);
  }
}
