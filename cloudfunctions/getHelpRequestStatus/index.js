// cloudfunctions/getHelpRequestStatus/index.js
// 获取求助请求状态云函数

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { token, requestId } = event;

  console.log('[GetHelpRequestStatus] Request:', {
    openid: wxContext.OPENID,
    requestId: requestId
  });

  try {
    // 获取请求状�?
    const result = await db.collection('help_requests').where({
      requestId: requestId,
      openid: wxContext.OPENID
    }).get();

    if (result.data.length === 0) {
      return {
        success: false,
        error: '请求不存�?
      };
    }

    const request = result.data[0];

    console.log('[GetHelpRequestStatus] Status:', request.status);

    return {
      success: true,
      requestId: request.requestId,
      status: request.status,
      type: request.type,
      note: request.note,
      matchedUsers: request.matchedUsers || [],
      activeHelperId: request.activeHelperId,
      createTime: request.createTime,
      matchTime: request.matchTime,
      expireTime: request.expireTime
    };

  } catch (err) {
    console.error('[GetHelpRequestStatus] Error:', err);
    return {
      success: false,
      error: err.message || '获取状态失�?
    };
  }
};

