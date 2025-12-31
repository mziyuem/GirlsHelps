// pages/messages/index.js
const cloud = require('../../utils/cloud.js');
const app = getApp();

Page({
  data: {
    conversations: [],
    loading: true,
    conversationWatcher: null,
    pollTimer: null
  },

  onLoad(options) {
    // 如果从推送进入，检查是否有requestId参数
    if (options.requestId) {
      console.log('[Messages] Entering from push notification, requestId:', options.requestId);
      this.handlePushNotification(options.requestId);
    }
    // 如果有conversationId参数，直接打开对话
    else if (options.conversationId) {
      this.openConversationById(options.conversationId);
    }
  },

  /**
   * 处理推送通知进入
   * 创建对话并跳转到聊天页面
   */
  handlePushNotification(requestId) {
    const wxContext = wx.cloud.getWXContext();
    const currentOpenid = wxContext.OPENID || '';

    if (!currentOpenid) {
      console.error('[Messages] No openid found');
      this.navigateToHome();
      return;
    }

    wx.showLoading({ title: '加载中...', mask: true });

    // 查询请求信息
    wx.cloud.database().collection('help_requests').where({
      requestId: requestId
    }).get().then(res => {
      if (res.data.length === 0) {
        wx.hideLoading();
        wx.showToast({
          title: '请求不存在或已过期',
          icon: 'none'
        });
        setTimeout(() => this.navigateToHome(), 1500);
        return;
      }

      const request = res.data[0];
      const requesterOpenid = request.openid;

      // 如果是自己发起的请求，跳转到首页
      if (requesterOpenid === currentOpenid) {
        wx.hideLoading();
        wx.showToast({
          title: '这是您发起的请求',
          icon: 'none'
        });
        setTimeout(() => this.navigateToHome(), 1500);
        return;
      }

      // 创建与请求者的对话并跳转
      this.createConversationAndChat(requesterOpenid, requestId);
    }).catch(err => {
      console.error('[Messages] Load request failed:', err);
      wx.hideLoading();
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      setTimeout(() => this.navigateToHome(), 1500);
    });
  },

  /**
   * 创建对话并跳转到聊天页面
   */
  createConversationAndChat(targetOpenid, relatedRequestId) {
    wx.cloud.callFunction({
      name: 'createConversation',
      data: {
        targetOpenid: targetOpenid,
        relatedRequestId: relatedRequestId
      }
    }).then(res => {
      wx.hideLoading();

      if (res.result.success) {
        console.log('[Messages] Conversation created:', res.result.conversationId);

        // 跳转到聊天页面
        wx.navigateTo({
          url: `/pages/chat/index?conversationId=${res.result.conversationId}`
        });
      } else {
        wx.showToast({
          title: res.result.error || '创建对话失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      console.error('[Messages] Create conversation failed:', err);
      wx.hideLoading();
      wx.showToast({
        title: '创建对话失败',
        icon: 'none'
      });
    });
  },

  /**
   * 跳转到首页
   */
  navigateToHome() {
    wx.switchTab({
      url: '/pages/home/index'
    });
  },

  onShow() {
    this.loadConversations();
  },

  onHide() {
    // 页面隐藏时停止监听
    this.stopWatching();
  },

  onUnload() {
    // 页面卸载时清理资源
    this.stopWatching();
  },

  /**
   * 停止监听对话
   */
  stopWatching() {
    if (this.data.conversationWatcher) {
      this.data.conversationWatcher.close();
      this.setData({ conversationWatcher: null });
    }
    if (this.data.pollTimer) {
      clearInterval(this.data.pollTimer);
      this.setData({ pollTimer: null });
    }
  },

  /**
   * 加载对话列表
   */
  loadConversations() {
    this.setData({ loading: true });

    const db = wx.cloud.database();
    const wxContext = wx.cloud.getWXContext();
    const currentOpenid = wxContext.OPENID || '';

    // 获取所有包含当前用户的对话
    db.collection('conversations').where({
      participants: currentOpenid
    }).orderBy('updateTime', 'desc').get().then(res => {
      console.log('Conversations loaded:', res.data);

      // 为每个对话获取对方用户信息
      const conversations = [];
      let completedCount = 0;

      if (res.data.length === 0) {
        this.setData({
          conversations: [],
          loading: false
        });
        // 即使没有对话也开始监听新对话
        this.startConversationWatch(currentOpenid);
        return;
      }

      res.data.forEach(conv => {
        // 找出对方的userId
        const otherUserId = conv.participants.find(id => id !== currentOpenid);

        // 获取对方用户信息
        db.collection('users').where({
          openid: otherUserId
        }).get().then(userRes => {
          const otherUserInfo = userRes.data[0] || {
            nickname: '匿名用户',
            avatarUrl: ''
          };

          conversations.push({
            ...conv,
            otherUserInfo: otherUserInfo
          });

          completedCount++;

          // 所有对话都处理完毕
          if (completedCount === res.data.length) {
            // 按更新时间排序
            conversations.sort((a, b) => {
              return new Date(b.updateTime) - new Date(a.updateTime);
            });

            this.setData({
              conversations: conversations,
              loading: false
            });

            // 开始监听对话变化
            this.startConversationWatch(currentOpenid);
          }
        }).catch(err => {
          console.error('Get user info failed:', err);
          completedCount++;

          if (completedCount === res.data.length) {
            conversations.sort((a, b) => {
              return new Date(b.updateTime) - new Date(a.updateTime);
            });

            this.setData({
              conversations: conversations,
              loading: false
            });

            this.startConversationWatch(currentOpenid);
          }
        });
      });
    }).catch(err => {
      console.error('Load conversations failed:', err);
      this.setData({
        conversations: [],
        loading: false
      });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    });
  },

  /**
   * 开始监听对话变化
   */
  startConversationWatch(openid) {
    const db = wx.cloud.database();

    // 先停止旧的监听
    this.stopWatching();

    try {
      this.data.conversationWatcher = db.collection('conversations')
        .where({
          participants: openid
        })
        .orderBy('updateTime', 'desc')
        .watch({
          onChange: (snapshot) => {
            console.log('Conversations changed:', snapshot);

            if (snapshot.docs.length >= 0) {
              this.loadConversations(); // 重新加载对话列表
            }
          },
          onError: (err) => {
            console.error('Conversation watch error:', err);
            // watch 失败时使用轮询
            this.startConversationPolling(openid);
          }
        });
    } catch (e) {
      console.error('Watch not available, using polling:', e);
      // watch 不可用时使用轮询
      this.startConversationPolling(openid);
    }
  },

  /**
   * 开始轮询对话（备用方案）
   */
  startConversationPolling(openid) {
    this.stopWatching(); // 确保没有重复监听

    const pollTimer = setInterval(() => {
      this.loadConversations();
    }, 5000); // 每5秒轮询一次

    this.setData({ pollTimer: pollTimer });
  },

  /**
   * 打开对话
   */
  openConversation(e) {
    const conversationId = e.currentTarget.dataset.id;
    this.openConversationById(conversationId);
  },

  /**
   * 根据ID打开对话
   */
  openConversationById(conversationId) {
    wx.navigateTo({
      url: `/pages/chat/index?conversationId=${conversationId}`
    });
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadConversations();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  }
});
