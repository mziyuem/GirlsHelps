// cloudfunctions/createConversation/index.js
// 创建对话云函数

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 生成对话ID
 */
function generateConversationId() {
  return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { targetUserId, targetOpenid, relatedRequestId } = event;

  console.log('[CreateConversation] Request:', {
    openid: wxContext.OPENID,
    targetUserId: targetUserId,
    targetOpenid: targetOpenid,
    relatedRequestId: relatedRequestId
  });

  try {
    let targetUserOpenid = targetOpenid; // 优先使用直接传入的 openid

    // 如果没有 targetOpenid，则通过 targetUserId 查找
    if (!targetUserOpenid && targetUserId) {
      const targetUserResult = await db.collection('users').where({
        userId: targetUserId
      }).get();

      if (targetUserResult.data.length === 0) {
        return {
          success: false,
          error: '用户不存在'
        };
      }

      targetUserOpenid = targetUserResult.data[0].openid;
    }

    // 确保找到了目标用户的 openid
    if (!targetUserOpenid) {
      return {
        success: false,
        error: '目标用户不存在'
      };
    }

    // 检查是否已存在该请求相关的对话
    const existingConvResult = await db.collection('conversations').where({
      participants: _.all([wxContext.OPENID, targetUserOpenid]),
      relatedRequestId: relatedRequestId || ''
    }).get();

    if (existingConvResult.data.length > 0) {
      // 对话已存在，直接返回该对话ID
      console.log('[CreateConversation] Existing conversation found:', existingConvResult.data[0].conversationId);
      return {
        success: true,
        conversationId: existingConvResult.data[0].conversationId,
        existing: true
      };
    }

    // 获取发起请求用户的信息（当前用户）
    const requesterResult = await db.collection('users').where({
      openid: wxContext.OPENID
    }).get();

    const requesterName = requesterResult.data[0] ? requesterResult.data[0].nickname : '匿名用户';

    // 创建新对话
    const now = new Date();
    const conversationId = generateConversationId();

    const conversationData = {
      conversationId: conversationId,
      participants: [wxContext.OPENID, targetUserOpenid],
      requesterOpenid: targetUserOpenid, // 请求发起者
      helperOpenid: wxContext.OPENID, // 帮助者（当前用户）
      relatedRequestId: relatedRequestId || '',
      createTime: now,
      updateTime: now,
      lastMessage: '发起了对话',
      lastMessageTime: now,
      unreadCount: 1,
      requesterUnreadCount: 1, // 请求者未读数
      helperUnreadCount: 0 // 帮助者未读数
    };

    await db.collection('conversations').add({
      data: conversationData
    });

    // 创建系统消息
    await db.collection('messages').add({
      data: {
        messageId: 'msg_' + Date.now() + '_system',
        conversationId: conversationId,
        senderId: wxContext.OPENID,
        content: `您好，我看到您的求助请求，可以为您提供帮助`,
        createTime: now,
        isSystem: true
      }
    });

    console.log('[CreateConversation] Conversation created:', conversationId);

    return {
      success: true,
      conversationId: conversationId,
      existing: false
    };

  } catch (err) {
    console.error('[CreateConversation] Error:', err);
    return {
      success: false,
      error: err.message || '创建对话失败'
    };
  }
};
