// test-login.js - 登录功能测试脚本
// 在微信开发者工具控制台中运行此脚本

console.log('=== Girls Help 登录功能测试 ===');

// 测试1: 检查云开发初始化
function testCloudInit() {
  console.log('\n[测试1] 云开发初始化...');

  if (!wx.cloud) {
    console.error('❌ 云开发 SDK 未加载');
    return false;
  }

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

// 测试2: 测试wx.login
function testWxLogin() {
  console.log('\n[测试2] 微信登录API测试...');

  return new Promise((resolve) => {
    wx.login({
      success: function (res) {
        console.log('✅ wx.login 成功:', res);
        if (res.code) {
          console.log('✅ 获取到登录code');
          resolve(true);
        } else {
          console.error('❌ 未获取到登录code');
          resolve(false);
        }
      },
      fail: function (err) {
        console.error('❌ wx.login 失败:', err);
        resolve(false);
      }
    });
  });
}

// 测试3: 测试用户信息获取
function testUserInfo() {
  console.log('\n[测试3] 用户信息获取测试...');

  return new Promise((resolve) => {
    // 检查授权状态
    wx.getSetting({
      success: function (res) {
        console.log('✅ getSetting 成功:', res.authSetting);

        const hasUserInfoAuth = res.authSetting['scope.userInfo'];
        console.log('用户信息授权状态:', hasUserInfoAuth);

        if (hasUserInfoAuth) {
          // 已授权，尝试获取用户信息
          wx.getUserInfo({
            success: function (userRes) {
              console.log('✅ getUserInfo 成功:', userRes.userInfo);
              resolve(true);
            },
            fail: function (err) {
              console.error('❌ getUserInfo 失败:', err);
              resolve(false);
            }
          });
        } else {
          console.log('⚠️ 用户未授权获取用户信息，将使用匿名登录');
          resolve(true); // 不算失败，只是未授权
        }
      },
      fail: function (err) {
        console.error('❌ getSetting 失败:', err);
        resolve(false);
      }
    });
  });
}

// 测试4: 测试云函数调用
function testCloudFunction() {
  console.log('\n[测试4] 云函数调用测试...');

  return new Promise((resolve) => {
    // 获取登录code
    wx.login({
      success: function (loginRes) {
        if (!loginRes.code) {
          console.error('❌ 获取登录code失败');
          resolve(false);
          return;
        }

        // 调用login云函数
        wx.cloud.callFunction({
          name: 'login',
          data: {
            code: loginRes.code,
            userInfo: {
              nickName: '测试用户',
              avatarUrl: '',
              isAnonymous: false
            }
          },
          success: function (res) {
            console.log('✅ 云函数login调用成功:', res.result);

            if (res.result && res.result.success) {
              console.log('✅ 登录成功，用户ID:', res.result.userInfo.userId);
              console.log('✅ Token:', res.result.token ? '已生成' : '未生成');

              // 保存到本地存储（测试用）
              wx.setStorageSync('test_token', res.result.token);
              wx.setStorageSync('test_userInfo', res.result.userInfo);

              resolve(true);
            } else {
              console.error('❌ 云函数返回失败:', res.result);
              resolve(false);
            }
          },
          fail: function (err) {
            console.error('❌ 云函数login调用失败:', err);
            resolve(false);
          }
        });
      },
      fail: function (err) {
        console.error('❌ 获取登录code失败:', err);
        resolve(false);
      }
    });
  });
}

// 测试5: 测试位置权限
function testLocationPermission() {
  console.log('\n[测试5] 位置权限测试...');

  return new Promise((resolve) => {
    wx.getSetting({
      success: function (res) {
        console.log('位置权限状态:', res.authSetting['scope.userLocation']);

        if (res.authSetting['scope.userLocation']) {
          console.log('✅ 已授权位置权限');

          // 尝试获取位置
          wx.getLocation({
            type: 'gcj02',
            success: function (locRes) {
              console.log('✅ 成功获取位置:', locRes);
              resolve(true);
            },
            fail: function (err) {
              console.error('❌ 获取位置失败:', err);
              resolve(false);
            }
          });
        } else {
          console.log('⚠️ 未授权位置权限');
          resolve(true); // 不算失败
        }
      },
      fail: function (err) {
        console.error('❌ 检查位置权限失败:', err);
        resolve(false);
      }
    });
  });
}

// 运行所有测试
async function runAllTests() {
  console.log('开始运行登录功能测试...\n');

  // 测试1: 云开发初始化
  const cloudOk = testCloudInit();
  if (!cloudOk) {
    console.log('\n❌ 云开发初始化失败，请检查配置');
    return;
  }

  // 测试2: 微信登录API
  const wxLoginOk = await testWxLogin();
  if (!wxLoginOk) {
    console.log('\n❌ 微信登录API测试失败');
    return;
  }

  // 测试3: 用户信息获取
  const userInfoOk = await testUserInfo();
  if (!userInfoOk) {
    console.log('\n❌ 用户信息获取测试失败');
    return;
  }

  // 测试4: 云函数调用
  const cloudFuncOk = await testCloudFunction();
  if (!cloudFuncOk) {
    console.log('\n❌ 云函数调用测试失败，请检查云函数部署');
    return;
  }

  // 测试5: 位置权限
  const locationOk = await testLocationPermission();

  console.log('\n=== 测试结果 ===');
  console.log('✅ 云开发初始化:', cloudOk ? '通过' : '失败');
  console.log('✅ 微信登录API:', wxLoginOk ? '通过' : '失败');
  console.log('✅ 用户信息获取:', userInfoOk ? '通过' : '失败');
  console.log('✅ 云函数调用:', cloudFuncOk ? '通过' : '失败');
  console.log('✅ 位置权限:', locationOk ? '通过' : '失败');

  if (cloudOk && wxLoginOk && userInfoOk && cloudFuncOk) {
    console.log('\n🎉 登录功能测试全部通过！');
    console.log('\n现在可以正常使用小程序登录功能了。');
  } else {
    console.log('\n❌ 部分测试失败，请检查相关配置。');
  }
}

// 执行测试
runAllTests().catch(err => {
  console.error('测试过程中发生错误:', err);
});

console.log('=== 测试脚本执行完毕 ===');

