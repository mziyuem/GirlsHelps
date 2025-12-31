// cloudfunctions/sendMessage/index.js
// 发送消息云函数

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 生成消息ID
 */
function generateMessageId() {
  return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { conversationId, content } = event;

  console.log('[SendMessage] Request:', {
    openid: wxContext.OPENID,
    conversationId: conversationId,
    content: content
  });

  try {
    // 获取对话信息
    const convResult = await db.collection('conversations').where({
      conversationId: conversationId
    }).get();

    if (convResult.data.length === 0) {
      return {
        success: false,
        error: '对话不存在'
      };
    }

    const conversation = convResult.data[0];

    // 检查用户是否在对话中
    if (!conversation.participants.includes(wxContext.OPENID)) {
      return {
        success: false,
        error: '无权发送消息'
      };
    }

    const now = new Date();
    const messageId = generateMessageId();

    // 创建消息
    const messageData = {
      messageId: messageId,
      conversationId: conversationId,
      senderId: wxContext.OPENID,
      content: content,
      createTime: now,
      read: false
    };

    await db.collection('messages').add({
      data: messageData
    });

    // 更新对话信息
    const otherUserId = conversation.participants.find(id => id !== wxContext.OPENID);
    const updateData = {
      lastMessage: content,
      lastMessageTime: now,
      updateTime: now
    };

    // 增加对方的未读数
    if (conversation.requesterOpenid === wxContext.OPENID) {
      updateData.helperUnreadCount = _.inc(1);
    } else {
      updateData.requesterUnreadCount = _.inc(1);
    }

    // 更新总未读数
    updateData.unreadCount = _.add(
      _.if(_.eq('$.requesterOpenid', wxContext.OPENID), '$.helperUnreadCount'),
      '$.requesterUnreadCount'
    );

    await db.collection('conversations').where({
      conversationId: conversationId
    }).update({
      data: updateData
    });

    // 检查是否有关联的请求，是否超时需要自动回复（10分钟）
    if (conversation.relatedRequestId) {
      const requestResult = await db.collection('help_requests').where({
        requestId: conversation.relatedRequestId
      }).get();

      if (requestResult.data.length > 0) {
        const request = requestResult.data[0];
        const createTime = new Date(request.createTime);
        const timeDiff = now - createTime;

        // 10分钟 = 600000毫秒
        if (timeDiff > 600000 && !request.autoReplied) {
          // 发送自动回复
          const autoReplyContent = `我在${request.location ? request.location.latitude + ',' + request.location.longitude : '附近'}为您准备了您需要的东西，现在去拿吧！`;

          const autoReplyId = generateMessageId();
          await db.collection('messages').add({
            data: {
              messageId: autoReplyId,
              conversationId: conversationId,
              senderId: otherUserId, // 从帮助者角度发送
              content: autoReplyContent,
              createTime: now,
              isAutoReply: true
            }
          });

          // 标记已自动回复
          await db.collection('help_requests').where({
            requestId: conversation.relatedRequestId
          }).update({
            data: {
              autoReplied: true
            }
          });

          console.log('[SendMessage] Auto-reply sent for timeout');
        }
      }
    }

    console.log('[SendMessage] Message sent:', messageId);

    return {
      success: true,
      messageId: messageId
    };

  } catch (err) {
    console.error('[SendMessage] Error:', err);
    return {
      success: false,
      error: err.message || '发送消息失败'
    };
  }
};
