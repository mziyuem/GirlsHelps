// 云函数：数据库初始化
// 这个文件用于初始化数据库集合和索引，确保数据库结构正确

const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  try {
    console.log('开始初始化数据库...');

    // 检查并创建集合
    const collections = ['users', 'help_requests', 'help_sessions'];

    for (const collectionName of collections) {
      try {
        // 检查集合是否存在
        await db.collection(collectionName).limit(1).get();
        console.log(`集合 ${collectionName} 已存在`);
      } catch (error) {
        if (error.errCode === -1) {
          console.log(`集合 ${collectionName} 不存在，将创建...`);
          // 集合不存在时会自动创建，这里只是检查
        }
      }
    }

    // 为 users 集合创建索引
    try {
      // 地理位置索引（用于附近用户查询）
      await db.collection('users').createIndex({
        indexName: 'location_index',
        keys: {
          'currentLocation': '2dsphere'
        }
      });
      console.log('users 集合地理位置索引创建成功');
    } catch (error) {
      if (error.errCode !== 110000) { // 索引已存在
        console.error('创建地理位置索引失败:', error);
      }
    }

    // 为 help_requests 集合创建索引
    try {
      // 地理位置索引
      await db.collection('help_requests').createIndex({
        indexName: 'request_location_index',
        keys: {
          'location': '2dsphere'
        }
      });

      // 状态和时间索引
      await db.collection('help_requests').createIndex({
        indexName: 'status_time_index',
        keys: {
          'status': 1,
          'createTime': -1
        }
      });

      console.log('help_requests 集合索引创建成功');
    } catch (error) {
      if (error.errCode !== 110000) { // 索引已存在
        console.error('创建 help_requests 索引失败:', error);
      }
    }

    console.log('数据库初始化完成');

    return {
      success: true,
      message: '数据库初始化成功',
      data: {
        collections: collections,
        indexes: ['location_index', 'request_location_index', 'status_time_index']
      }
    };

  } catch (error) {
    console.error('数据库初始化失败:', error);
    return {
      success: false,
      error: error.message || '数据库初始化失败'
    };
  }
};
