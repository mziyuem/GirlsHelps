// pages/session/index.js
const cloud = require('../../utils/cloud.js');
const app = getApp();

// 获取默认头像
const defaultAvatar = cloud.getDefaultAvatar ? cloud.getDefaultAvatar() : '';

Page({
  data: {
    sessionId: '', // 会话ID
    sessionInfo: {
      status: 'loading',
      statusText: '加载中...',
      meetingPoint: '',
      meetingTime: null,
      otherAvatar: '',
      otherNickName: ''
    },
    messages: [], // 消息列表
    inputMessage: '', // 输入的消息
    meetingPointInput: '', // 见面地点输入
    userInfo: {}, // 当前用户信息
    scrollTop: 0, // 滚动位置
    pollTimer: null, // 轮询定时器
    POLL_INTERVAL: 3000 // 轮询间隔3秒
  },

  /**
   * 页面加载
   */
  onLoad: function (options) {
    console.log('Session page loaded:', options);

    const { sessionId } = options;
    if (!sessionId) {
      wx.showToast({
        title: '缺少会话ID',
        icon: 'none'
      });
      wx.navigateBack();
      return;
    }

    this.setData({
      sessionId: sessionId,
      userInfo: app.globalData.userInfo || {}
    });

    // 加载会话信息和消息
    this.loadSessionInfo();
    this.getLatestMessages();
  },

  /**
   * 页面卸载
   */
  onUnload: function () {
    this.clearPollTimer();
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh: function () {
    this.loadSessionInfo();
    wx.stopPullDownRefresh();
  },

  /**
   * 加载会话信息
   */
  loadSessionInfo: function () {
    const that = this;

    // 调用云函数获取会话详情
    cloud.getSessionDetail(this.data.sessionId)
      .then(res => {
        console.log('Session detail:', res);

        const session = res.session;
        that.setData({
          sessionInfo: {
            status: session.status || 'active',
            statusText: session.status === 'completed' ? '已完成' : '进行中',
            meetingPoint: session.meetingPoint || '',
            meetingTime: session.meetingTime || null,
            otherAvatar: defaultAvatar, // 使用默认头像，因为API中已移除avatarUrl字段
            otherNickName: session.otherUser.nickName || '姐妹'
          }
        });
      })
      .catch(err => {
        console.error('Get session detail failed:', err);
        wx.showToast({
          title: err.error || '加载会话信息失败',
          icon: 'none'
        });
      });

    // 开始轮询消息
    this.startPollingMessages();
  },

  /**
   * 开始轮询消息
   */
  startPollingMessages: function () {
    this.clearPollTimer();
    this.pollMessages();

    const timer = setInterval(() => {
      this.pollMessages();
    }, this.data.POLL_INTERVAL);

    this.setData({
      pollTimer: timer
    });
  },

  /**
   * 轮询消息
   */
  pollMessages: function () {
    // 调用云函数获取最新消息
    this.getLatestMessages();
  },

  /**
   * 获取最新消息
   */
  getLatestMessages: function () {
    const that = this;

    // 调用云函数获取消息
    cloud.getSessionMessages(this.data.sessionId)
      .then(res => {
        console.log('Session messages:', res);
        if (res.messages && res.messages.length > 0) {
          that.setData({
            messages: res.messages
          });
          // 滚动到底部
          that.scrollToBottom();
        }
      })
      .catch(err => {
        console.error('Get messages failed:', err);
        wx.showToast({
          title: err.error || '获取消息失败',
          icon: 'none'
        });
      });
  },

  /**
   * 发送消息
   */
  sendMessage: function () {
    const message = this.data.inputMessage.trim();
    if (!message) {
      wx.showToast({
        title: '请输入消息内容',
        icon: 'none'
      });
      return;
    }

    // 调用云函数发送消息
    this.sendMessageToServer(message);
  },

  /**
   * 发送消息到服务器
   */
  sendMessageToServer: function (content) {
    const that = this;

    // 调用云函数发送消息
    cloud.sendSessionMessage(this.data.sessionId, content, 'text')
      .then(res => {
        console.log('Send message success:', res);
        // 添加到本地消息列表
        const newMessage = res.message;

        const newMessages = [...that.data.messages, newMessage];
        that.setData({
          messages: newMessages,
          inputMessage: ''
        });

        // 滚动到底部
        that.scrollToBottom();
      })
      .catch(err => {
        console.error('Send message failed:', err);
        wx.showToast({
          title: err.error || '发送失败',
          icon: 'none'
        });
      });
  },

  /**
   * 设置见面地点
   */
  setMeetingPoint: function () {
    const meetingPoint = this.data.meetingPointInput.trim();
    if (!meetingPoint) {
      wx.showToast({
        title: '请输入见面地点',
        icon: 'none'
      });
      return;
    }

    // 调用云函数设置见面地点
    this.setMeetingPointToServer(meetingPoint);
  },

  /**
   * 设置见面地点到服务器
   */
  setMeetingPointToServer: function (meetingPoint) {
    const that = this;

    // 调用云函数设置见面信息
    cloud.setMeetingInfo(this.data.sessionId, meetingPoint)
      .then(res => {
        console.log('Set meeting info success:', res);
        that.setData({
          'sessionInfo.meetingPoint': res.meetingPoint,
          'sessionInfo.meetingTime': res.meetingTime,
          meetingPointInput: ''
        });

        wx.showToast({
          title: '见面地点已设置',
          icon: 'success'
        });
      })
      .catch(err => {
        console.error('Set meeting info failed:', err);
        wx.showToast({
          title: err.error || '设置失败',
          icon: 'none'
        });
      });
  },

  /**
   * 导航前往见面地点
   */
  navigateToMeeting: function () {
    const meetingPoint = this.data.sessionInfo.meetingPoint;
    if (!meetingPoint) {
      wx.showToast({
        title: '未设置见面地点',
        icon: 'none'
      });
      return;
    }

    // 这里可以调用地图导航
    // 暂时显示提示
    wx.showToast({
      title: '导航功能开发中',
      icon: 'none'
    });
  },

  /**
   * 完成会话
   */
  completeSession: function () {
    const that = this;

    wx.showModal({
      title: '完成互助',
      content: '确认互助已完成吗？',
      success: function (res) {
        if (res.confirm) {
          that.completeSessionToServer();
        }
      }
    });
  },

  /**
   * 完成会话到服务器
   */
  completeSessionToServer: function () {
    const that = this;

    // 调用云函数完成会话
    cloud.completeSession(this.data.sessionId)
      .then(res => {
        console.log('Complete session success:', res);
        that.setData({
          'sessionInfo.status': 'completed',
          'sessionInfo.statusText': '已完成'
        });

        that.clearPollTimer();

        wx.showToast({
          title: res.message || '互助完成！',
          icon: 'success'
        });
      })
      .catch(err => {
        console.error('Complete session failed:', err);
        wx.showToast({
          title: err.error || '操作失败',
          icon: 'none'
        });
      });
  },

  /**
   * 输入消息
   */
  onInputMessage: function (e) {
    this.setData({
      inputMessage: e.detail.value
    });
  },

  /**
   * 输入见面地点
   */
  onInputMeetingPoint: function (e) {
    this.setData({
      meetingPointInput: e.detail.value
    });
  },

  /**
   * 格式化时间
   */
  formatTime: function (timeStr) {
    if (!timeStr) return '';

    const time = new Date(timeStr);
    const now = new Date();
    const diff = now.getTime() - time.getTime();

    // 一分钟内
    if (diff < 60000) {
      return '刚刚';
    }

    // 一小时内
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}分钟前`;
    }

    // 今天
    if (time.toDateString() === now.toDateString()) {
      return time.toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    // 昨天
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (time.toDateString() === yesterday.toDateString()) {
      return '昨天 ' + time.toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    // 其他日期
    return time.toLocaleDateString('zh-CN') + ' ' + time.toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  /**
   * 滚动到底部
   */
  scrollToBottom: function () {
    const that = this;
    setTimeout(() => {
      that.setData({
        scrollTop: 999999
      });
    }, 100);
  },

  /**
   * 清除轮询定时器
   */
  clearPollTimer: function () {
    if (this.data.pollTimer) {
      clearInterval(this.data.pollTimer);
      this.setData({
        pollTimer: null
      });
    }
  }
});
