// deploy-functions.js - 云函数部署验证和修复脚本
// 在微信开发者工具控制台中运行此脚本

console.log('=== Girls Help 云函数部署检查 ===');

// 检查云开发环境
function checkCloudEnv() {
  console.log('\n[检查1] 云开发环境...');

  if (!wx.cloud) {
    console.error('❌ 云开发 SDK 未加载');
    console.log('💡 请使用微信开发者工具，确保基础库版本 >= 2.2.3');
    return false;
  }

  try {
    wx.cloud.init({
      env: 'cloud1-8ggz6j81c4d33fbe',
      traceUser: true
    });
    console.log('✅ 云开发环境初始化成功');
    return true;
  } catch (err) {
    console.error('❌ 云开发环境初始化失败:', err);
    console.log('💡 请检查环境ID是否正确');
    return false;
  }
}

// 检查单个云函数
async function checkFunction(functionName) {
  console.log(`🔧 检查云函数: ${functionName}`);

  return new Promise((resolve) => {
    // 尝试调用云函数（使用简单的测试参数）
    const testData = functionName === 'login' ? {
      code: 'test_code',
      userInfo: { nickName: '测试' }
    } : {};

    wx.cloud.callFunction({
      name: functionName,
      data: testData,
      success: (res) => {
        console.log(`✅ 云函数 ${functionName} 调用成功`);
        resolve(true);
      },
      fail: (err) => {
        console.error(`❌ 云函数 ${functionName} 调用失败:`, err.errMsg);

        // 检查是否是函数不存在的错误
        if (err.errMsg.includes('FUNCTION_NOT_FOUND') ||
            err.errMsg.includes('FunctionName parameter could not be found')) {
          console.log(`💡 云函数 ${functionName} 未部署`);
          resolve(false);
        } else {
          console.log(`⚠️ 云函数 ${functionName} 存在但有其他错误`);
          resolve(true); // 函数存在，只是调用有问题
        }
      }
    });
  });
}

// 检查所有云函数
async function checkAllFunctions() {
  console.log('\n[检查2] 云函数部署状态...');

  const functions = [
    'login',
    'getUserProfile',
    'createHelpRequest',
    'getHelpRequestStatus',
    'cancelHelpRequest',
    'completeHelp',
    'getNearbyUsers',
    'updateUserResources',
    'updatePrivacySetting',
    'updateUserLocation',
    'contactUser',
    'emotionSupport',
    'initDatabase'
  ];

  const results = {};
  let deployedCount = 0;

  for (const funcName of functions) {
    const isDeployed = await checkFunction(funcName);
    results[funcName] = isDeployed;
    if (isDeployed) deployedCount++;
  }

  console.log(`\n📊 部署统计: ${deployedCount}/${functions.length} 个云函数已部署`);

  const notDeployed = functions.filter(f => !results[f]);
  if (notDeployed.length > 0) {
    console.log('❌ 未部署的云函数:', notDeployed.join(', '));
  }

  return results;
}

// 显示部署指南
function showDeployGuide() {
  console.log('\n🔧 云函数部署指南:');
  console.log('='.repeat(50));
  console.log('');
  console.log('方法1: 使用微信开发者工具');
  console.log('1. 点击顶部菜单 "云开发"');
  console.log('2. 选择 "云函数" 面板');
  console.log('3. 点击 "上传并部署" 按钮');
  console.log('4. 选择 "cloudfunctions" 文件夹');
  console.log('5. 等待所有云函数上传完成');
  console.log('');
  console.log('方法2: 使用命令行工具 (需要安装CLI)');
  console.log('wxcloud functions:deploy --functions login,getUserProfile,createHelpRequest,...');
  console.log('');
  console.log('方法3: 使用部署脚本');
  console.log('双击运行 deploy-cloud.bat 文件');
  console.log('');
  console.log('='.repeat(50));
}

// 重新部署云函数
function redeployFunctions() {
  console.log('\n🚀 开始重新部署云函数...');

  // 显示部署指南
  showDeployGuide();

  console.log('\n📝 部署步骤:');
  console.log('1. 在微信开发者工具中打开项目');
  console.log('2. 点击菜单 "工具" → "云开发"');
  console.log('3. 确保选择了正确的环境: cloud1-8ggz6j81c4d33fbe');
  console.log('4. 点击 "云函数" 标签');
  console.log('5. 右键点击 "cloudfunctions" 文件夹');
  console.log('6. 选择 "上传并部署：云端安装依赖"');
  console.log('7. 等待部署完成');
  console.log('');
  console.log('部署完成后，运行检查: require("./deploy-functions.js").checkAllFunctions()');
}

// 快速部署验证
async function quickVerify() {
  console.log('🔍 执行快速验证...');

  const envOk = checkCloudEnv();
  if (!envOk) return;

  const results = await checkAllFunctions();

  const deployedFunctions = Object.keys(results).filter(f => results[f]);
  const notDeployedFunctions = Object.keys(results).filter(f => !results[f]);

  if (notDeployedFunctions.length === 0) {
    console.log('\n🎉 所有云函数都已正确部署！');
    console.log('现在可以正常使用小程序了。');
  } else {
    console.log(`\n❌ 发现 ${notDeployedFunctions.length} 个云函数未部署:`);
    console.log(notDeployedFunctions.join(', '));
    console.log('\n请按照上述指南重新部署云函数。');
  }

  return results;
}

// 导出函数
module.exports = {
  checkCloudEnv,
  checkFunction,
  checkAllFunctions,
  showDeployGuide,
  redeployFunctions,
  quickVerify
};

// 显示使用说明
console.log('\n📖 使用说明:');
console.log('快速验证: require("./deploy-functions.js").quickVerify()');
console.log('检查所有: require("./deploy-functions.js").checkAllFunctions()');
console.log('部署指南: require("./deploy-functions.js").showDeployGuide()');

console.log('\n=== 脚本加载完成 ===');

