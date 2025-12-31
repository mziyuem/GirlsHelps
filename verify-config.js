// verify-config.js - 配置验证脚本
// 在微信开发者工具控制台中运行此脚本验证配置

console.log('=== Girls Help 配置验证 ===');

// 验证云环境ID配置
function verifyCloudConfig() {
  console.log('\n[验证1] 云环境ID配置...');

  try {
    // 从app.js中读取配置（模拟）
    const expectedEnv = 'cloud1-8ggz6j81c4d33fbe';
    console.log('✅ 期望的云环境ID:', expectedEnv);

    // 尝试初始化云开发
    wx.cloud.init({
      env: expectedEnv,
      traceUser: true
    });

    console.log('✅ 云开发初始化成功');
    return true;
  } catch (err) {
    console.error('❌ 云开发初始化失败:', err);
    return false;
  }
}

// 验证小程序配置
function verifyAppConfig() {
  console.log('\n[验证2] 小程序配置检查...');

  const app = getApp();
  if (!app) {
    console.error('❌ 无法获取小程序实例');
    return false;
  }

  console.log('✅ 小程序实例获取成功');

  // 检查全局数据
  if (typeof app.globalData === 'object') {
    console.log('✅ 全局数据结构正确');
    console.log('   - 登录状态:', app.globalData.isLoggedIn || false);
    console.log('   - 用户信息:', !!app.globalData.userInfo);
    console.log('   - Token:', !!app.globalData.token);
  } else {
    console.error('❌ 全局数据结构异常');
    return false;
  }

  return true;
}

// 验证页面配置
function verifyPageConfig() {
  console.log('\n[验证3] 页面配置检查...');

  const pages = [
    'pages/Login/index',
    'pages/home/index',
    'pages/map/index',
    'pages/profile/index'
  ];

  let allValid = true;

  pages.forEach(pagePath => {
    try {
      // 检查页面是否可以访问
      const page = getCurrentPages().find(p => p.route === pagePath);
      if (page) {
        console.log(`✅ 页面 ${pagePath} 已加载`);
      } else {
        console.log(`⚠️  页面 ${pagePath} 未在当前页面栈中`);
      }
    } catch (err) {
      console.error(`❌ 页面 ${pagePath} 配置错误:`, err);
      allValid = false;
    }
  });

  return allValid;
}

// 验证云函数可用性
function verifyCloudFunctions() {
  console.log('\n[验证4] 云函数可用性检查...');

  const functions = [
    'login',
    'getUserProfile',
    'createHelpRequest',
    'getNearbyUsers'
  ];

  let completed = 0;
  const total = functions.length;

  functions.forEach(funcName => {
    wx.cloud.callFunction({
      name: funcName,
      data: {},
      success: (res) => {
        console.log(`✅ 云函数 ${funcName} 可访问`);
        completed++;
        if (completed === total) {
          console.log(`\n🎉 所有云函数验证完成！`);
          showNextSteps();
        }
      },
      fail: (err) => {
        console.error(`❌ 云函数 ${funcName} 不可访问:`, err);
        completed++;
        if (completed === total) {
          console.log(`\n⚠️ 部分云函数验证完成，请检查云函数部署`);
          showNextSteps();
        }
      }
    });
  });
}

// 显示后续步骤
function showNextSteps() {
  console.log('\n=== 后续步骤 ===');
  console.log('1. 运行小程序 - 应该自动跳转到登录页面');
  console.log('2. 点击"微信登录" - 完成授权');
  console.log('3. 进入主界面 - 测试各项功能');
  console.log('4. 如有问题，请查看控制台错误日志');
  console.log('\n=== 配置验证完成 ===');
}

// 执行验证
console.log('开始验证配置...\n');

const cloudOk = verifyCloudConfig();
const appOk = verifyAppConfig();
const pageOk = verifyPageConfig();

if (cloudOk && appOk && pageOk) {
  console.log('\n✅ 基础配置验证通过，开始验证云函数...');
  verifyCloudFunctions();
} else {
  console.log('\n❌ 基础配置验证失败，请检查配置');
  showNextSteps();
}
