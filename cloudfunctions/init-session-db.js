// 云函数：初始化会话数据库
// 创建会话相关的数据库集合和索引

const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  try {
    console.log('开始初始化会话数据库');

    // 检查并创建session_messages集合
    try {
      // 尝试获取集合信息，如果不存在会抛出错误
      await db.collection('session_messages').count();
      console.log('session_messages集合已存在');
    } catch (error) {
      console.log('session_messages集合不存在，创建中...');

      // 创建集合（通过添加第一条数据来创建）
      await db.collection('session_messages').add({
        data: {
          sessionId: 'init',
          fromUserId: 'system',
          content: '初始化消息',
          type: 'system',
          createTime: new Date()
        }
      });

      // 删除初始化数据
      await db.collection('session_messages').where({
        sessionId: 'init'
      }).remove();

      console.log('session_messages集合创建成功');
    }

    // 检查并创建emotion_logs集合（情绪支持日志）
    try {
      await db.collection('emotion_logs').count();
      console.log('emotion_logs集合已存在');
    } catch (error) {
      console.log('emotion_logs集合不存在，创建中...');

      await db.collection('emotion_logs').add({
        data: {
          userId: 'init',
          message: '初始化日志',
          emotion: 'default',
          createTime: new Date()
        }
      });

      await db.collection('emotion_logs').where({
        userId: 'init'
      }).remove();

      console.log('emotion_logs集合创建成功');
    }

    console.log('会话数据库初始化完成');

    return {
      success: true,
      message: '数据库初始化成功'
    };

  } catch (error) {
    console.error('初始化会话数据库失败:', error);
    return {
      success: false,
      error: error.message || '数据库初始化失败'
    };
  }
};
