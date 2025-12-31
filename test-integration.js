// test-integration.js - 完整集成测试脚本
// 在微信开发者工具控制台中运行此脚本测试前后端集成

console.log('=== Girls Help 集成测试 ===');

// 测试1: 检查云开发初始化
function testCloudInit() {
  console.log('\n[测试1] 云开发初始化...');

  if (!wx.cloud) {
    console.error('❌ 云开发 SDK 未加载');
    return false;
  }

  console.log('✅ 云开发 SDK 已加载');

  try {
    wx.cloud.init({
      env: 'cloud1-8ggz6j81c4d33fbe',
      traceUser: true
    });
    console.log('✅ 云开发初始化成功');
    return true;
  } catch (err) {
    console.error('❌ 云开发初始化失败:', err);
    return false;
  }
}

// 测试2: 检查数据库连接
function testDatabase() {
  console.log('\n[测试2] 数据库连接...');

  const db = wx.cloud.database();

  return new Promise((resolve) => {
    db.collection('users').count()
      .then(res => {
        console.log('✅ 数据库连接成功，users集合文档数:', res.total);

        // 如果没有数据，添加测试数据
        if (res.total === 0) {
          console.log('⚠️ 数据库为空，正在添加测试数据...');
          addTestData().then(() => resolve(true)).catch(err => {
            console.error('❌ 添加测试数据失败:', err);
            resolve(false);
          });
        } else {
          resolve(true);
        }
      })
      .catch(err => {
        console.error('❌ 数据库连接失败:', err);
        resolve(false);
      });
  });
}

// 添加测试数据
function addTestData() {
  const db = wx.cloud.database();

  const testUsers = [
    {
      userId: 'test_user_001',
      nickName: '测试姐妹1',
      avatarUrl: '',
      isAnonymous: false,
      resources: ['卫生巾', '纸巾'],
      showOnMap: true,
      stats: { helpGiven: 2, helpReceived: 1 },
      currentLocation: {
        latitude: 39.9042,
        longitude: 116.4074,
        accuracy: 100
      },
      privacyOffset: 200,
      joinTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      lastActiveTime: new Date(),
      createTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    },
    {
      userId: 'test_user_002',
      nickName: '测试姐妹2',
      avatarUrl: '',
      isAnonymous: false,
      resources: ['暖宝宝', '充电宝'],
      showOnMap: true,
      stats: { helpGiven: 1, helpReceived: 3 },
      currentLocation: {
        latitude: 39.9045,
        longitude: 116.4078,
        accuracy: 80
      },
      privacyOffset: 200,
      joinTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      lastActiveTime: new Date(),
      createTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    }
  ];

  const promises = testUsers.map(user =>
    db.collection('users').add({ data: user })
  );

  return Promise.all(promises);
}

// 测试3: 检查云函数
function testCloudFunctions() {
  console.log('\n[测试3] 云函数测试...');

  return new Promise((resolve) => {
    // 测试登录云函数
    wx.login({
      success: (loginRes) => {
        wx.cloud.callFunction({
          name: 'login',
          data: {
            code: loginRes.code,
            userInfo: {
              nickName: '集成测试用户',
              avatarUrl: '',
              isAnonymous: true
            }
          },
          success: (res) => {
            console.log('✅ 登录云函数调用成功:', res.result);

            if (res.result.success) {
              // 测试获取用户信息云函数
              wx.cloud.callFunction({
                name: 'getUserProfile',
                data: { token: res.result.token },
                success: (profileRes) => {
                  console.log('✅ 获取用户信息成功:', profileRes.result);

                  if (profileRes.result.success) {
                    // 测试附近用户查询
                    testNearbyUsers().then(() => resolve(true));
                  } else {
                    console.error('❌ 获取用户信息失败');
                    resolve(false);
                  }
                },
                fail: (err) => {
                  console.error('❌ getUserProfile 云函数调用失败:', err);
                  resolve(false);
                }
              });
            } else {
              console.error('❌ 登录云函数返回失败');
              resolve(false);
            }
          },
          fail: (err) => {
            console.error('❌ 登录云函数调用失败:', err);
            resolve(false);
          }
        });
      },
      fail: (err) => {
        console.error('❌ wx.login 失败:', err);
        resolve(false);
      }
    });
  });
}

// 测试附近用户查询
function testNearbyUsers() {
  console.log('\n[测试4] 附近用户查询测试...');

  return new Promise((resolve) => {
    wx.cloud.callFunction({
      name: 'getNearbyUsers',
      data: {
        location: { latitude: 39.9042, longitude: 116.4074 },
        radius: 2000,
        limit: 10
      },
      success: (res) => {
        console.log('✅ 附近用户查询成功:', res.result);

        if (res.result.success && res.result.users) {
          console.log(`📍 找到 ${res.result.users.length} 位附近用户`);
        }

        resolve(true);
      },
      fail: (err) => {
        console.error('❌ 附近用户查询失败:', err);
        resolve(false);
      }
    });
  });
}

// 运行所有测试
async function runAllTests() {
  console.log('开始运行集成测试...\n');

  // 测试1: 云开发初始化
  const cloudOk = testCloudInit();

  if (!cloudOk) {
    console.log('\n❌ 云开发初始化失败，请检查配置');
    return;
  }

  // 测试2: 数据库连接
  const dbOk = await testDatabase();

  if (!dbOk) {
    console.log('\n❌ 数据库连接失败，请检查云开发环境和权限');
    return;
  }

  // 测试3: 云函数
  const functionsOk = await testCloudFunctions();

  if (!functionsOk) {
    console.log('\n❌ 云函数测试失败，请检查云函数部署');
    return;
  }

  console.log('\n🎉 所有测试通过！系统运行正常');
  console.log('\n可以开始使用小程序了：');
  console.log('1. 运行小程序会自动跳转到登录页面');
  console.log('2. 完成登录后进入主界面');
  console.log('3. 测试求助、地图浏览、个人设置等功能');
}

// 执行测试
runAllTests().catch(err => {
  console.error('测试过程中发生错误:', err);
});

console.log('=== 测试脚本执行完毕 ===');
