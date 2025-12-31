// test-cloud.js - 云开发连接测试脚本
// 在微信开发者工具的控制台中运行此脚本

console.log('=== 云开发连接测试 ===');

// 检查云开发是否可用
if (!wx.cloud) {
  console.error('❌ 云开发 SDK 未加载');
  return;
}

console.log('✅ 云开发 SDK 已加载');

// 初始化云开发
wx.cloud.init({
  env: 'cloud1-8ggz6j81c4d33fbe', // 云环境ID
  traceUser: true
});

console.log('✅ 云开发已初始化');

// 测试获取用户信息
wx.login({
  success: function(loginRes) {
    console.log('✅ wx.login 成功:', loginRes.code);

    // 测试云函数调用
    wx.cloud.callFunction({
      name: 'login',
      data: {
        code: loginRes.code,
        userInfo: {
          nickName: '测试用户',
          avatarUrl: '',
          isAnonymous: true
        }
      },
      success: function(res) {
        console.log('✅ 云函数 login 调用成功:', res.result);
      },
      fail: function(err) {
        console.error('❌ 云函数 login 调用失败:', err);
      }
    });
  },
  fail: function(err) {
    console.error('❌ wx.login 失败:', err);
  }
});

// 测试数据库连接
const db = wx.cloud.database();
db.collection('users').count()
  .then(res => {
    console.log('✅ 数据库连接成功，users集合文档数:', res.total);
  })
  .catch(err => {
    console.error('❌ 数据库连接失败:', err);
  });

console.log('=== 测试完成 ===');
