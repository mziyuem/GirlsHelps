// cloudfunctions/contactUser/index.js
// 联系用户云函数

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 生成联系记录ID
 */
function generateContactId() {
  return 'contact_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { token, targetUserId, type } = event;

  console.log('[ContactUser] Request:', {
    openid: wxContext.OPENID,
    targetUserId: targetUserId,
    type: type
  });

  try {
    // 获取当前用户信息
    const currentUserResult = await db.collection('users').where({
      _openid: wxContext.OPENID
    }).get();

    if (currentUserResult.data.length === 0) {
      return {
        success: false,
        error: '用户不存在'
      };
    }

    const currentUser = currentUserResult.data[0];

    // 获取目标用户信息
    const targetUserResult = await db.collection('users').where({
      userId: targetUserId
    }).get();

    if (targetUserResult.data.length === 0) {
      return {
        success: false,
        error: '目标用户不存在'
      };
    }

    const targetUser = targetUserResult.data[0];

    // 创建联系记录
    const contactId = generateContactId();
    const now = new Date();

    const contactData = {
      _openid: wxContext.OPENID,
      contactId: contactId,
      fromUserId: currentUser.userId,
      fromNickName: currentUser.nickName,
      toOpenid: targetUser._openid,
      toUserId: targetUser.userId,
      type: type, // 'help_request' | 'help_offer'
      status: 'pending',
      message: type === 'help_request' ? '需要您的帮助' : '我可以帮助您',
      createTime: now,
      responseTime: null
    };

    await db.collection('contact_records').add({
      data: contactData
    });

    // TODO: 可以在这里添加订阅消息推送通知目标用户

    console.log('[ContactUser] Contact created:', contactId);

    return {
      success: true,
      contactId: contactId,
      message: '已发送通知'
    };

  } catch (err) {
    console.error('[ContactUser] Error:', err);
    return {
      success: false,
      error: err.message || '联系失败'
    };
  }
};
