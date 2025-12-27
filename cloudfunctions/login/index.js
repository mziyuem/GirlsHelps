// cloudfunctions/login/index.js
// 微信登录云函数

const cloud = require('wx-server-sdk');

cloud.init({
  env: 'cloud1-8ggz6j81c4d33fbe'
});

const db = cloud.database();
const _ = db.command;

/**
 * 生成用户唯一ID
 */
function generateUserId() {
  return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * 生成token
 */
function generateToken(openid) {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substr(2, 16);
  return Buffer.from(openid + ':' + timestamp + ':' + randomStr).toString('base64');
}

/**
 * 计算加入天数
 */
function calculateJoinDays(joinTime) {
  if (!joinTime) return 0;
  const now = new Date();
  const join = new Date(joinTime);
  const diffTime = Math.abs(now - join);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { code, userInfo } = event;

  console.log('[Login] Request:', {
    openid: wxContext.OPENID,
    userInfo: userInfo
  });

  try {
    // ========== 修改1：查询字段从 _openid 改为 openid（匹配索引） ==========
    // 检查用户是否存在（用openid查询，而非_openid）
    const userResult = await db.collection('users').where({
      openid: wxContext.OPENID // 关键：和数据库索引字段一致
    }).get();

    let user;
    let isNewUser = false;

    if (userResult.data.length === 0) {
      // 新用户，创建记录
      isNewUser = true;
      const now = db.serverDate(); // 修改2：改用云端时间，避免本地时间偏差

      user = {
        // ========== 修改3：字段名从 _openid 改为 openid（核心！） ==========
        openid: wxContext.OPENID, // 匹配数据库唯一索引字段，杜绝null
        userId: generateUserId(),
        nickName: userInfo.nickName || '姐妹',
        avatarUrl: userInfo.avatarUrl || '',
        isAnonymous: userInfo.isAnonymous || false,
        resources: [],
        showOnMap: true,
        stats: {
          helpGiven: 0,
          helpReceived: 0
        },
        currentLocation: null,
        privacyOffset: 200,
        joinTime: now,
        lastActiveTime: now,
        createTime: now
      };

      // ========== 修改4：用 doc(openid).set 替代 add（杜绝重复+保证openid非空） ==========
      // 用openid作为文档ID，强制唯一，避免add生成随机ID导致的问题
      const addResult = await db.collection('users').doc(wxContext.OPENID).set({
        data: user,
        merge: false // 新用户直接创建，不合并（merge仅老用户需要）
      });

      user._id = wxContext.OPENID; // 文档ID就是openid，无需从addResult取
      console.log('[Login] New user created:', user.userId);

    } else {
      // 老用户，更新最后活跃时间
      user = userResult.data[0];
      const now = db.serverDate(); // 修改2：改用云端时间

      // ========== 修改5：更新时用文档ID（user._id），保证精准 ==========
      await db.collection('users').doc(user._id).update({
        data: {
          lastActiveTime: now,
          // 仅更新有变化的用户信息，避免覆盖
          ...(userInfo?.nickName && userInfo.nickName !== user.nickName ? { nickName: userInfo.nickName } : {}),
          ...(userInfo?.avatarUrl && userInfo.avatarUrl !== user.avatarUrl ? { avatarUrl: userInfo.avatarUrl } : {})
        }
      });

      user.lastActiveTime = now;
      console.log('[Login] Existing user:', user.userId);
    }

    // 生成token
    const token = generateToken(wxContext.OPENID);

    // 计算加入天数
    const joinDays = calculateJoinDays(user.joinTime);

    return {
      success: true,
      token: token,
      userInfo: {
        userId: user.userId,
        nickName: user.nickName,
        avatarUrl: user.avatarUrl,
        isAnonymous: user.isAnonymous,
        joinDays: joinDays,
        resources: user.resources || [],
        showOnMap: user.showOnMap,
        stats: user.stats || { helpGiven: 0, helpReceived: 0 }
      },
      isNewUser: isNewUser
    };

  } catch (err) {
    console.error('[Login] Error:', err);
    return {
      success: false,
      error: err.message || '登录失败'
    };
  }
};
