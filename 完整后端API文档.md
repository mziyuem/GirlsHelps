# Girls Help - 完整后端API文档

## 项目概述

Girls Help 是一款面向女性的轻量化即时互助小程序，专注于解决女性在公共场景中遇到的即时性需求问题。核心功能包括：

- **即时求助**: 用户点击首页按钮即可发起求助，系统自动获取位置并推送给附近用户
- **地图互助**: 展示附近可提供帮助的用户，支持安全的位置协商
- **情绪支持**: 基于关键词的情绪识别和意象化回应
- **隐私保护**: 位置模糊处理、匿名机制、一次性协作

## 一、数据库设计

### 1. 用户集合 (users)

```javascript
{
  _id: ObjectId,                    // MongoDB自动生成
  _openid: String,                  // 微信云开发自动获取
  userId: String,                   // 用户唯一ID (user_时间戳_随机数)
  nickName: String,                 // 昵称
  resources: [String],              // 可提供的资源 ['卫生巾', '纸巾', '暖宝宝', '热水', '充电宝']
  showOnMap: Boolean,               // 是否在地图上显示 (默认true)
  stats: {
    helpGiven: Number,              // 帮助他人次数 (默认0)
    helpReceived: Number            // 获得帮助次数 (默认0)
  },
  currentLocation: {
    latitude: Number,               // 当前纬度
    longitude: Number,              // 当前经度
    accuracy: Number,               // 位置精度
    updateTime: Date                // 更新时间（每次登录都需要更新当前位置信息）
  },
  privacyOffset: Number,            // 隐私偏移量(米，默认200)
  joinTime: Date,                   // 加入时间
}
```

### 2. 求助请求集合 (help_requests)

```javascript
{
  _id: ObjectId,                    // MongoDB自动生成
  _openid: String,                  // 求助者openid
  userId: String,                   // 求助者userId
  requestId: String,                // 请求唯一ID (req_时间戳_随机数)
  type: String,                     // 请求类型: 'pad'(卫生巾), 'tissue'(纸巾), 'safety'(安全陪伴), 'emotion'(情绪支持), 'other'(其他)
  note: String,                     // 补充说明
  status: String,                   // 状态: 'pending'(等待中), 'matched'(已匹配), 'active'(进行中), 'completed'(已完成), 'cancelled'(已取消), 'expired'(已过期)
  location: {
    latitude: Number,               // 请求位置纬度
    longitude: Number,              // 请求位置经度
    accuracy: Number                // 位置精度
  },
  matchedUsers: [String],           // 匹配的用户ID列表 (可多个响应者)
  activeHelperId: String,           // 当前活跃的帮助者ID
  createTime: Date,                 // 创建时间
  matchTime: Date,                  // 首次匹配时间
  completeTime: Date,               // 完成时间
  expireTime: Date,                 // 过期时间 (默认30分钟后)
  cancelTime: Date                  // 取消时间
}
```

### 3. 互助会话集合 (help_sessions)

```javascript
{
  _id: ObjectId,                    // MongoDB自动生成
  sessionId: String,                // 会话唯一ID (session_时间戳_随机数)
  requestId: String,                // 关联的求助请求ID
  seekerId: String,                 // 求助者ID
  helperId: String,                 // 帮助者ID
  status: String,                   // 状态: 'active'(进行中), 'completed'(已完成), 'cancelled'(已取消)
  meetingPoint: String,             // 约定见面地点描述
  meetingTime: Date,                // 约定见面时间
  messages: [
    {
      fromUserId: String,           // 发送者ID
      content: String,              // 消息内容
      type: String,                 // 消息类型: 'text', 'location', 'system'
      createTime: Date              // 发送时间
    }
  ],
  createTime: Date,                 // 创建时间
  completeTime: Date                // 完成时间
}
```

## 二、云函数API列表

### API 1: 微信登录 (login)

1.登录：微信getUserProfile和getUserInfo不能使用，采取wx.login+后端生成token持久化存储的方式，记录每位微信用户的唯一的id并在该用户后续的登陆中调用保存的nickname,ip等数据
2.请求帮助：用户id发送消息保存状态，数据库在users表查找currentLocation和求助者位置信息附近10km以内的用户并发送小程序推送
3.地图：展示该用户位置附近的用户信息及可提供的东西
4.会话:保存，更新
5.个人信息页：更新users