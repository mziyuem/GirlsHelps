// cloudfunctions/updateUserInfo/index.js
// 更新用户信息云函数

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  // 从event中提取token和用户信息字段
  const { token, nickName, ip, ...otherFields } = event;

  console.log('[UpdateUserInfo] Request:', {
    openid: wxContext.OPENID,
    nickName: nickName,
    ip: ip,
    otherFields: otherFields
  });

  try {
    // 先查询用户是否存在（使用where查询更安全）
    const userQuery = await db.collection('users').where({
      openid: wxContext.OPENID
    }).get();

    console.log('[UpdateUserInfo] User query result:', {
      found: userQuery.data.length > 0,
      openid: wxContext.OPENID
    });

    if (userQuery.data.length === 0) {
      console.error('[UpdateUserInfo] User not found with openid:', wxContext.OPENID);
      return {
        success: false,
        error: '用户不存在，openid: ' + wxContext.OPENID
      };
    }

    // 构建更新数据对象
    const updateData = {};

    // 根据传入的字段动态更新
    if (nickName !== undefined) {
      updateData.nickName = nickName;
      console.log('[UpdateUserInfo] Updating nickName to:', nickName);
    }
    if (ip !== undefined) {
      updateData.ip = ip;
      console.log('[UpdateUserInfo] Updating ip to:', ip);
    }

    // 检查是否有其他需要更新的字段
    Object.keys(otherFields).forEach(key => {
      if (key !== 'token' && otherFields[key] !== undefined) {
        updateData[key] = otherFields[key];
        console.log(`[UpdateUserInfo] Updating ${key} to:`, otherFields[key]);
      }
    });

    console.log('[UpdateUserInfo] Update data:', updateData);

    // 检查是否有数据需要更新
    if (Object.keys(updateData).length === 0) {
      console.error('[UpdateUserInfo] No data to update');
      return {
        success: false,
        error: '没有需要更新的数据'
      };
    }

    // 使用where条件更新，避免文档ID问题
    const result = await db.collection('users').where({
      openid: wxContext.OPENID
    }).update({
      data: updateData
    });

    console.log('[UpdateUserInfo] Updated, stats:', result.stats);

    // 获取更新后的用户信息
    const userRes = await db.collection('users').where({
      openid: wxContext.OPENID
    }).get();

    if (userRes.data.length > 0) {
      console.log('[UpdateUserInfo] Updated user data:', userRes.data[0]);
      return {
        success: true,
        message: '用户信息已更新',
        user: userRes.data[0]
      };
    } else {
      return {
        success: true,
        message: '用户信息已更新'
      };
    }

  } catch (err) {
    console.error('[UpdateUserInfo] Error:', err);
    return {
      success: false,
      error: err.message || '更新用户信息失败'
    };
  }
};
