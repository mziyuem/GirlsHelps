# Girls Help 云函数文档

## 概述

Girls Help 小程序的云函数实现，基于微信云开发平台。

## 云函数列表

### 1. init-db
数据库初始化函数，创建必要的集合和索引。

### 2. login
微信登录认证，创建或更新用户信息。

**参数：**
- `code`: wx.login() 获取的 code
- `userInfo`: 用户信息对象

**返回值：**
- `token`: 访问令牌
- `userInfo`: 用户信息
- `isNewUser`: 是否新用户

### 3. getUserProfile
获取用户完整资料。

**参数：**
- `token`: 访问令牌

**返回值：**
- `user`: 用户完整信息

### 4. updateUserResources
更新用户可提供的资源。

**参数：**
- `token`: 访问令牌
- `resources`: 资源数组

### 5. updatePrivacySetting
更新隐私设置（是否在地图上显示）。

**参数：**
- `token`: 访问令牌
- `showOnMap`: 布尔值

### 6. updateUserLocation
更新用户位置信息。

**参数：**
- `token`: 访问令牌
- `location`: 位置对象 {latitude, longitude, accuracy}

### 7. createHelpRequest
创建求助请求。

**参数：**
- `token`: 访问令牌
- `type`: 请求类型 ('pad', 'tissue', 'safety', 'emotion', 'other')
- `note`: 补充说明
- `location`: 位置信息

**返回值：**
- `requestId`: 请求ID
- `nearbyUsersCount`: 附近用户数量

### 8. getHelpRequestStatus
获取求助请求状态。

**参数：**
- `token`: 访问令牌
- `requestId`: 请求ID

**返回值：**
- `status`: 请求状态
- `request`: 请求详情

### 9. cancelHelpRequest
取消求助请求。

**参数：**
- `token`: 访问令牌
- `requestId`: 请求ID

### 10. completeHelp
完成互助。

**参数：**
- `token`: 访问令牌
- `requestId`: 请求ID

### 11. getNearbyUsers
获取附近用户。

**参数：**
- `token`: 访问令牌
- `location`: 位置信息
- `radius`: 搜索半径（米，默认2000）
- `limit`: 返回数量限制（默认20）

**返回值：**
- `users`: 附近用户数组

### 12. contactUser
联系用户，创建互助会话。

**参数：**
- `token`: 访问令牌
- `targetUserId`: 目标用户ID
- `type`: 联系类型 ('help_request', 'help_offer')

### 13. emotionSupport
情绪支持功能。

**参数：**
- `token`: 访问令牌
- `message`: 用户输入的消息

**返回值：**
- `result`: 支持内容 {image, role, text, suggestion}

## 数据库结构

### users 集合
```javascript
{
  _id: ObjectId,
  _openid: String,
  userId: String,
  nickName: String,
  avatarUrl: String,
  resources: [String],
  showOnMap: Boolean,
  stats: {
    helpGiven: Number,
    helpReceived: Number
  },
  currentLocation: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    updateTime: Date
  },
  privacyOffset: Number,
  joinTime: Date
}
```

### help_requests 集合
```javascript
{
  _id: ObjectId,
  _openid: String,
  userId: String,
  requestId: String,
  type: String,
  typeText: String,
  note: String,
  status: String,
  location: Object,
  matchedUsers: [String],
  activeHelperId: String,
  createTime: Date,
  matchTime: Date,
  completeTime: Date,
  expireTime: Date,
  cancelTime: Date
}
```

### help_sessions 集合
```javascript
{
  _id: ObjectId,
  sessionId: String,
  requestId: String,
  seekerId: String,
  helperId: String,
  status: String,
  meetingPoint: String,
  meetingTime: Date,
  messages: [Object],
  createTime: Date,
  completeTime: Date
}
```

## 部署步骤

1. 在微信开发者工具中打开项目
2. 右键 cloudfunctions 文件夹，选择"同步云函数列表"
3. 等待同步完成
4. 运行 `init-db` 云函数初始化数据库
5. 测试各个云函数功能

## 注意事项

1. 确保云环境ID配置正确
2. 模板消息功能需要先在微信公众平台配置模板
3. 地理位置查询需要正确的索引设置
4. 所有云函数都有完善的错误处理和参数校验
