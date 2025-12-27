# Girls Help - 微信云开发部署指南

本文档详细说明如何部署微信云开发后端并配置前端。

---

## 一、云开发环境初始化

### 1.1 创建云开发环境

1. 打开微信开发者工具，打开项目 `E:\AIProject\GIRL`
2. 点击顶部菜单 **云开发** → **开通**
3. 创建云开发环境，记录下 **环境ID**（如：`cloud1-xxx`）

### 1.2 修改云环境ID

打开 `app.js`，找到第 42 行，将 `your-env-id` 替换为你的云环境ID：

```javascript
wx.cloud.init({
  env: 'your-env-id', // 替换为你的云环境ID
  traceUser: true
});
```

---

## 二、云函数部署

### 2.1 上传所有云函数

在微信开发者工具中：

1. 右键点击 `cloudfunctions` 文件夹
2. 选择 **当前环境** → **上传并部署：云端安装依赖**
3. 等待所有云函数上传完成

需要上传的云函数（共12个）：
- `login`
- `createHelpRequest`
- `getHelpRequestStatus`
- `cancelHelpRequest`
- `completeHelp`
- `getNearbyUsers`
- `getUserProfile`
- `updateUserResources`
- `updatePrivacySetting`
- `updateUserLocation`
- `contactUser`
- `emotionSupport`

### 2.2 云函数权限配置

每个云函数需要配置权限，在云开发控制台中：

1. 进入 **云函数** → 点击云函数名称
2. 点击 **配置** → **权限设置**
3. 选择 **所有用户可访问** 或 **仅创建者可访问**（根据需求）

---

## 三、数据库集合创建

在云开发控制台的 **数据库** 页面，创建以下集合：

### 3.1 创建集合

点击 **添加集合**，依次创建：

1. **users** - 用户信息
2. **help_requests** - 求助请求
3. **contact_records** - 联系记录
4. **emotion_supports** - 情绪支持记录

### 3.2 集合权限设置

每个集合创建后，设置权限：

| 集合名称 | 权限设置 |
|---------|---------|
| users | 所有用户可读，仅创建者可写 |
| help_requests | 所有用户可读，仅创建者可写 |
| contact_records | 所有用户可读，仅创建者可写 |
| emotion_supports | 所有用户可读，仅创建者可写 |

### 3.3 数据库索引（可选，提升查询性能）

在 **数据库** → 选择集合 → **索引管理** 中添加：

#### users 集合索引
- 字段：`showOnMap`，类型：`1`（升序）
- 字段：`currentLocation.latitude`，类型：`2d_sphere`
- 字段：`_openid`，类型：`Text`

#### help_requests 集合索引
- 字段：`requestId`，类型：`Text`
- 字段：`_openid`，类型：`Text`
- 字段：`status`，类型：`Text`

---

## 四、数据库结构说明

### 4.1 users 集合

```javascript
{
  "_id": ObjectId,           // 自动生成
  "_openid": String,         // 微信openid（自动获取）
  "userId": String,          // 用户唯一ID
  "nickName": String,        // 昵称
  "avatarUrl": String,       // 头像URL
  "isAnonymous": Boolean,    // 是否匿名
  "resources": Array,        // 可提供的资源 ["卫生巾", "纸巾"]
  "showOnMap": Boolean,      // 是否在地图上显示
  "stats": {
    "helpGiven": Number,     // 帮助他人次数
    "helpReceived": Number   // 获得帮助次数
  },
  "currentLocation": {
    "latitude": Number,
    "longitude": Number,
    "accuracy": Number,
    "updateTime": Date
  },
  "privacyOffset": Number,   // 隐私偏移量（米）
  "joinTime": Date,          // 加入时间
  "lastActiveTime": Date,    // 最后活跃时间
  "createTime": Date
}
```

### 4.2 help_requests 集合

```javascript
{
  "_id": ObjectId,
  "_openid": String,         // 求助者openid
  "userId": String,
  "requestId": String,       // 请求唯一ID
  "type": String,            // 类型: 'pad', 'tissue', 'safety', 'other'
  "note": String,            // 补充说明
  "status": String,          // 'pending', 'matched', 'active', 'completed', 'cancelled'
  "location": {
    "latitude": Number,
    "longitude": Number,
    "accuracy": Number
  },
  "matchedHelperId": String, // 匹配的帮助者ID
  "createTime": Date,
  "matchTime": Date,
  "completeTime": Date,
  "cancelTime": Date
}
```

### 4.3 contact_records 集合

```javascript
{
  "_id": ObjectId,
  "_openid": String,         // 发起者openid
  "contactId": String,
  "fromUserId": String,
  "fromNickName": String,
  "toOpenid": String,        // 接收者openid
  "toUserId": String,
  "type": String,            // 'help_request' | 'help_offer'
  "status": String,          // 'pending', 'accepted', 'rejected', 'completed'
  "message": String,
  "createTime": Date,
  "responseTime": Date
}
```

### 4.4 emotion_supports 集合

```javascript
{
  "_id": ObjectId,
  "_openid": String,
  "input": String,
  "result": {
    "image": String,         // 'bird', 'flower', 'rain'
    "role": String,
    "text": String
  },
  "createTime": Date
}
```

---

## 五、前端配置检查清单

- [x] `app.js` 中云环境ID已配置
- [x] `app.json` 中 `"cloud": true` 已添加
- [x] `utils/cloud.js` 云函数调用工具类已创建
- [x] 所有页面已引入 `cloud.js` 并调用云函数

---

## 六、测试步骤

### 6.1 登录测试

1. 打开小程序
2. 进入登录页面
3. 点击授权登录
4. 检查 `users` 集合中是否创建了用户记录

### 6.2 求助功能测试

1. 点击求助按钮
2. 选择帮助类型
3. 提交请求
4. 检查 `help_requests` 集合中是否创建了请求记录
5. 等待5秒后检查状态是否变为 `matched`

### 6.3 地图功能测试

1. 进入地图页面
2. 允许位置权限
3. 检查地图上是否显示附近用户标记
4. 点击标记测试联系功能

### 6.4 个人中心测试

1. 进入个人中心
2. 检查用户信息是否正确显示
3. 测试地图显示开关
4. 测试资源编辑功能

---

## 七、常见问题

### Q1: 云函数调用失败

**原因**：云函数未上传或环境ID配置错误

**解决**：
1. 检查云开发控制台，确认云函数已上传
2. 检查 `app.js` 中的环境ID是否正确

### Q2: 数据库写入失败

**原因**：数据库权限未正确配置

**解决**：
1. 在云开发控制台检查集合权限设置
2. 确保权限为 "仅创建者可写"

### Q3: 附近用户无法显示

**原因**：
1. 没有用户开启地图显示
2. 当前用户没有位置权限

**解决**：
1. 在个人中心开启 "显示在地图上"
2. 添加一些可提供的资源
3. 确保位置权限已开启

### Q4: 登录后跳转失败

**原因**：页面路径配置错误

**解决**：
1. 检查 `app.json` 中的页面路径是否正确
2. 确保登录页面不是 tabBar 页面

---

## 八、安全注意事项

1. **位置隐私**：服务器返回的位置已做模糊处理（200米偏移）
2. **数据权限**：用户只能修改自己的数据
3. **openid 保护**：使用 `cloud.getWXContext()` 获取，不依赖前端传入
4. **频率限制**：建议在云函数中添加请求频率限制

---

## 九、后续优化建议

1. **实时匹配**：使用云数据库实时监听功能实现真正的实时匹配
2. **消息推送**：集成微信订阅消息，通知用户有新的求助/帮助
3. **评价系统**：添加互助完成后的双向评价
4. **聊天功能**：添加互助双方的即时通讯
5. **数据分析**：使用云开发数据分析功能了解用户行为

---

## 十、云函数部署命令（CLI）

如果使用微信云开发 CLI，可以使用以下命令：

```bash
# 部署所有云函数
wxcloud functions:deploy --functions login,createHelpRequest,getHelpRequestStatus,cancelHelpRequest,completeHelp,getNearbyUsers,getUserProfile,updateUserResources,updatePrivacySetting,updateUserLocation,contactUser,emotionSupport
```

---

## 联系支持

如有问题，请查阅：
- [微信云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
- [云函数文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/functions.html)
- [云数据库文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/database.html)
