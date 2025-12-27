// cloudfunctions/completeHelp/index.js
// 完成互助云函数

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { token, requestId } = event;

  console.log('[CompleteHelp] Request:', {
    openid: wxContext.OPENID,
    requestId: requestId
  });

  try {
    // 获取请求
    const result = await db.collection('help_requests').where({
      requestId: requestId,
      _openid: wxContext.OPENID
    }).get();

    if (result.data.length === 0) {
      return {
        success: false,
        error: '请求不存在'
      };
    }

    const request = result.data[0];

    // 检查状态
    if (request.status === 'completed') {
      return {
        success: false,
        error: '该请求已完成'
      };
    }

    if (request.status === 'cancelled') {
      return {
        success: false,
        error: '该请求已取消'
      };
    }

    // 更新请求状态为已完成
    await db.collection('help_requests').doc(request._id).update({
      data: {
        status: 'completed',
        completeTime: new Date()
      }
    });

    // 更新求助者的统计
    await db.collection('users').where({
      _openid: wxContext.OPENID
    }).update({
      data: {
        'stats.helpReceived': _.inc(1)
      }
    });

    // 如果有匹配的帮助者，更新帮助者的统计
    if (request.matchedHelperId) {
      await db.collection('users').where({
        userId: request.matchedHelperId
      }).update({
        data: {
          'stats.helpGiven': _.inc(1)
        }
      });
    }

    console.log('[CompleteHelp] Help completed:', requestId);

    return {
      success: true,
      message: '互助完成！感谢使用'
    };

  } catch (err) {
    console.error('[CompleteHelp] Error:', err);
    return {
      success: false,
      error: err.message || '操作失败'
    };
  }
};
