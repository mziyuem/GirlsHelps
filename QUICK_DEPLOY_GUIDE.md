# ⚡ 快速部署指南 - 云函数未部署问题

## 🚨 当前问题
**错误信息**: `errCode: -501000 | FunctionName parameter could not be found`
**原因**: `login` 云函数未部署到云端

---

## 🛠️ 立即解决（3步搞定）

### 步骤1: 打开云开发控制台
1. 在微信开发者工具中点击顶部菜单 **"工具"**
2. 选择 **"云开发"**
3. 确保选择了环境: `cloud1-8ggz6j81c4d33fbe`

### 步骤2: 部署云函数
1. 点击 **"云函数"** 标签页
2. 右键点击项目中的 **"cloudfunctions"** 文件夹
3. 选择 **"上传并部署：云端安装依赖"**
4. 等待进度条完成（可能需要1-2分钟）

### 步骤3: 验证部署
在控制台运行：
```javascript
// 验证login云函数是否部署成功
wx.cloud.callFunction({
  name: 'login',
  data: { code: 'test', userInfo: { nickName: 'test' } },
  success: (res) => console.log('✅ 部署成功:', res),
  fail: (err) => console.log('❌ 仍未部署:', err)
});
```

---

## 🔍 验证所有云函数

运行完整检查：
```javascript
require("./deploy-functions.js").quickVerify()
```

看到所有云函数都是 ✅ 表示部署完成。

---

## 🎯 部署成功的标志

- ✅ 控制台显示: `"云函数 login 调用成功"`
- ✅ 小程序登录时不再报函数找不到错误
- ✅ 可以正常进入主界面

---

## 🆘 如果部署失败

### 方案1: 检查环境
- 确保选择了正确的环境ID: `cloud1-8ggz6j81c4d33fbe`
- 检查网络连接是否正常

### 方案2: 单个部署
如果批量部署失败，可以单个部署：
1. 右键 `cloudfunctions/login` 文件夹
2. 选择 "上传并部署：云端安装依赖"
3. 对每个云函数重复此操作

### 方案3: 重新创建云函数
如果仍然失败：
1. 在云开发控制台删除所有云函数
2. 重新右键部署 `cloudfunctions` 文件夹

---

## 📊 云函数列表

需要部署的13个云函数：
- ✅ login - 用户登录
- ✅ getUserProfile - 获取用户信息
- ✅ createHelpRequest - 创建求助请求
- ✅ getHelpRequestStatus - 获取请求状态
- ✅ cancelHelpRequest - 取消请求
- ✅ completeHelp - 完成互助
- ✅ getNearbyUsers - 获取附近用户
- ✅ updateUserResources - 更新用户资源
- ✅ updatePrivacySetting - 更新隐私设置
- ✅ updateUserLocation - 更新位置信息
- ✅ contactUser - 联系用户
- ✅ emotionSupport - 情绪支持
- ✅ initDatabase - 数据库初始化

---

## 🚀 部署完成后

1. **重启小程序**
2. **测试登录功能** - 应该能正常登录
3. **测试其他功能** - 地图、求助等都应该正常工作

---

**完成云函数部署后，你的Girls Help小程序就可以正常使用了！🎉**

