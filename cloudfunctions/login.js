// 云函数：微信登录
// 处理微信登录，创建或更新用户信息，返回token

const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 生成用户ID
function generateUserId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `user_${timestamp}_${random}`;
}

// 生成token
function generateToken(userId) {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  return `token_${userId}_${timestamp}_${random}`;
}

exports.main = async (event, context) => {
  const { code, userInfo } = event;

  try {
    console.log('开始处理登录请求:', { code: code ? 'provided' : 'missing', userInfo: userInfo ? 'provided' : 'missing' });

    // 参数校验
    if (!code) {
      return {
        success: false,
        error: '缺少登录凭证code'
      };
    }

    if (!userInfo || !userInfo.nickName) {
      return {
        success: false,
        error: '缺少用户信息'
      };
    }

    // 获取微信OpenID
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;

    if (!openid) {
      return {
        success: false,
        error: '获取微信OpenID失败'
      };
    }

    console.log('获取到OpenID:', openid);

    // 检查用户是否已存在
    const userQuery = await db.collection('users').where({
      _openid: openid
    }).get();

    let userId;
    let isNewUser = false;

    if (userQuery.data.length > 0) {
      // 用户已存在，更新信息
      const existingUser = userQuery.data[0];
      userId = existingUser.userId;

      console.log('用户已存在，更新信息:', userId);

      await db.collection('users').doc(existingUser._id).update({
        data: {
          nickName: userInfo.nickName,
          avatarUrl: userInfo.avatarUrl || '',
          joinTime: existingUser.joinTime || new Date()
        }
      });
    } else {
      // 新用户，创建用户记录
      userId = generateUserId();
      isNewUser = true;

      console.log('创建新用户:', userId);

      const userData = {
        _openid: openid,
        userId: userId,
        nickName: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl || '',
        resources: [], // 可提供的资源
        showOnMap: true, // 默认在地图上显示
        stats: {
          helpGiven: 0, // 帮助他人次数
          helpReceived: 0 // 获得帮助次数
        },
        currentLocation: null, // 当前位置
        privacyOffset: 200, // 隐私偏移量(米)
        joinTime: new Date()
      };

      await db.collection('users').add({
        data: userData
      });
    }

    // 生成token
    const token = generateToken(userId);

    // 获取完整的用户信息
    const userDoc = await db.collection('users').where({
      userId: userId
    }).get();

    const user = userDoc.data[0];

    console.log('登录成功:', { userId, isNewUser });

    return {
      success: true,
      token: token,
      userInfo: {
        userId: user.userId,
        nickName: user.nickName,
        avatarUrl: user.avatarUrl,
        resources: user.resources || [],
        stats: user.stats || { helpGiven: 0, helpReceived: 0 },
        showOnMap: user.showOnMap !== false,
        joinTime: user.joinTime
      },
      isNewUser: isNewUser
    };

  } catch (error) {
    console.error('登录处理失败:', error);
    return {
      success: false,
      error: error.message || '登录失败，请稍后重试'
    };
  }
};
