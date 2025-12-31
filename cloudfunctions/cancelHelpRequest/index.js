// cloudfunctions/cancelHelpRequest/index.js
// 取消求助请求云函�?

const cloud = require('wx-server-sdk');

cloud.init({
  env: 'cloud1-8ggz6j81c4d33fbe'
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { token, requestId } = event;

  console.log('[CancelHelpRequest] Request:', {
    openid: wxContext.OPENID,
    requestId: requestId
  });

  try {
    // 获取请求
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

    // 检查状态是否可以取�?
    if (request.status === 'completed' || request.status === 'cancelled') {
      return {
        success: false,
        error: '该请求已完成或已取消'
      };
    }

    // 如果已经匹配，需要通知帮助�?
    if (request.status === 'matched' || request.status === 'active') {
      // TODO: 可以添加通知帮助者的逻辑
    }

    // 更新状态为已取�?
    await db.collection('help_requests').doc(request._id).update({
      data: {
        status: 'cancelled',
        cancelTime: new Date()
      }
    });

    console.log('[CancelHelpRequest] Request cancelled:', requestId);

    return {
      success: true,
      message: '已取消求助请�?
    };

  } catch (err) {
    console.error('[CancelHelpRequest] Error:', err);
    return {
      success: false,
      error: err.message || '取消请求失败'
    };
  }
};

