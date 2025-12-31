// cloudfunctions/initDatabase/index.js
// 数据库初始化云函数

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  console.log('[InitDatabase] Initializing database...');

  try {
    // 检查是否为管理员（这里简化处理，实际应该验证用户权限）
    // 实际应用中应该验证管理员身份

    // 尝试创建集合（如果不存在）
    const collections = ['users', 'help_requests', 'help_sessions', 'emotion_supports'];

    for (const collectionName of collections) {
      try {
        // 检查集合是否存在
        const collection = cloud.database().collection(collectionName);
        await collection.count();

        console.log(`[InitDatabase] Collection ${collectionName} already exists`);
      } catch (err) {
        console.log(`[InitDatabase] Collection ${collectionName} does not exist, creating...`);
        // 集合不存在时会自动创建，这里不需要特殊处理
      }
    }

    // 尝试添加一些测试数据
    const db = cloud.database();

    // 检查是否已有测试用户（不检查_openid，因为那是系统字段）
    const testUserCount = await db.collection('users').where({
      userId: 'test_user_001'
    }).count();

    if (testUserCount.total === 0) {
      console.log('[InitDatabase] Adding test user...');

      await db.collection('users').add({
        data: {
          _openid: 'test_openid_001', // 测试用openid
          userId: 'test_user_001',
          nickName: '测试用户1',
          resources: ['卫生巾', '纸巾'],
          showOnMap: true,
          stats: {
            helpGiven: 2,
            helpReceived: 1
          },
          currentLocation: {
            latitude: 39.9042,
            longitude: 116.4074,
            accuracy: 100,
            updateTime: new Date()
          },
          privacyOffset: 200,
          joinTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7天前
        }
      });

      await db.collection('users').add({
        data: {
          _openid: 'test_openid_002', // 测试用openid
          userId: 'test_user_002',
          nickName: '测试用户2',
          resources: ['暖宝宝', '充电宝'],
          showOnMap: true,
          stats: {
            helpGiven: 1,
            helpReceived: 3
          },
          currentLocation: {
            latitude: 39.9045,
            longitude: 116.4078,
            accuracy: 80,
            updateTime: new Date()
          },
          privacyOffset: 200,
          joinTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3天前
        }
      });

      console.log('[InitDatabase] Test users added');
    }

    return {
      success: true,
      message: 'Database initialized successfully',
      collections: collections,
      testUsersAdded: testUserCount.total === 0
    };

  } catch (err) {
    console.error('[InitDatabase] Error:', err);
    return {
      success: false,
      error: err.message || 'Database initialization failed'
    };
  }
};
