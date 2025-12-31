// cloudfunctions/completeHelp/index.js
// 完成互助云函数 - 支持地点输入和自动销毁相关对话

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { token, requestId, meetingLocation, meetingNotes, completedConversationId } = event;

  console.log('[CompleteHelp] Request:', {
    openid: wxContext.OPENID,
    requestId: requestId,
    meetingLocation: meetingLocation,
    completedConversationId: completedConversationId
  });

  try {
    // 获取请求
    const result = await db.collection('help_requests').where({
      requestId: requestId
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

    // 获取当前用户的userId
    const currentUserResult = await db.collection('users').where({
      openid: wxContext.OPENID
    }).get();

    if (currentUserResult.data.length === 0) {
      return {
        success: false,
        error: '用户不存在'
      };
    }

    const currentUserId = currentUserResult.data[0].userId;

    // 更新请求状态为已完成，存储完成信息
    await db.collection('help_requests').doc(request._id).update({
      data: {
        status: 'completed',
        completeTime: new Date(),
        completedBy: currentUserId,
        meetingLocation: meetingLocation || '',
        meetingNotes: meetingNotes || '',
        completedConversationId: completedConversationId || null
      }
    });

    // 更新求助者的统计
    await db.collection('users').where({
      openid: request.openid
    }).update({
      data: {
        'stats.helpReceived': _.inc(1)
      }
    });

    // 更新帮助者的统计（当前用户如果不是求助者）
    if (request.openid !== wxContext.OPENID) {
      await db.collection('users').where({
        openid: wxContext.OPENID
      }).update({
        data: {
          'stats.helpGiven': _.inc(1)
        }
      });
    }

    // 如果有指定的已完成对话，删除该请求的其他对话
    if (completedConversationId) {
      console.log('[CompleteHelp] Destroying other conversations for request:', requestId);

      // 获取该请求的所有对话
      const conversationsResult = await db.collection('conversations').where({
        relatedRequestId: requestId
      }).get();

      console.log('[CompleteHelp] Found conversations:', conversationsResult.data.length);

      // 删除除已完成对话外的所有对话
      for (const conv of conversationsResult.data) {
        if (conv.conversationId !== completedConversationId) {
          console.log('[CompleteHelp] Deleting conversation:', conv.conversationId);

          // 删除对话
          await db.collection('conversations').doc(conv._id).remove();

          // 删除该对话的所有消息
          await db.collection('messages').where({
            conversationId: conv.conversationId
          }).remove();
        }
      }

      console.log('[CompleteHelp] Other conversations destroyed');
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

