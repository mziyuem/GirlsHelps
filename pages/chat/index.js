// pages/chat/index.js
const cloud = require('../../utils/cloud.js');
const app = getApp();

// 获取默认头像
const defaultAvatar = cloud.getDefaultAvatar ? cloud.getDefaultAvatar() : '';

Page({
  data: {
    defaultAvatar: defaultAvatar, // 默认头像
    conversationId: '',
    currentUserId: '',
    otherUserId: '',
    currentUserInfo: {},
    otherUserInfo: {},
    messages: [],
    inputText: '',
    lastMessageId: '',
    isTyping: false,
    // 完成按钮：只有请求者且状态为active时显示
    showCompleteButton: false,
    // 蜡烛功能：只有请求者且有匹配者时显示
    showCandle: false,
    // 帮助者列表
    helpersList: [],
    showHelpersModal: false,
    // 完成互助弹窗
    showCompleteModal: false,
    meetingLocation: '',
    meetingNotes: '',
    // 请求相关信息
    relatedRequestId: '',
    isRequester: false,
    // 消息监听器
    messageWatcher: null,
    // 轮询定时器
    pollTimer: null
  },

  onLoad(options) {
    const conversationId = options.conversationId;
    if (!conversationId) {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    // 使用 wx.cloud.getWXContext() 获取当前用户 openid
    const wxContext = wx.cloud.getWXContext();
    this.setData({
      conversationId: conversationId,
      currentUserId: wxContext.OPENID || ''
    });

    this.loadConversation();
  },

  onShow() {
    // 加载对话时标记为已读
    if (this.data.conversationId) {
      this.markAsRead();
    }
    // 重新开始监听消息
    this.startMessageWatch();
  },

  onHide() {
    // 页面隐藏时停止监听
    this.stopMessageWatch();
  },

  onUnload() {
    // 页面卸载时清理资源
    this.stopMessageWatch();
  },

  /**
   * 加载对话信息
   */
  loadConversation() {
    const db = wx.cloud.database();

    db.collection('conversations').where({
      conversationId: this.data.conversationId
    }).get().then(res => {
      if (res.data.length === 0) {
        wx.showToast({
          title: '对话不存在',
          icon: 'none'
        });
        return;
      }

      const conv = res.data[0];
      const otherUserId = conv.participants.find(id => id !== this.data.currentUserId);

      // 获取消息
      this.loadMessages();

      // 获取对方用户信息
      db.collection('users').where({
        openid: otherUserId
      }).get().then(userRes => {
        this.setData({
          otherUserInfo: userRes.data[0] || { nickname: '匿名用户' }
        });
      });

      // 获取当前用户信息
      db.collection('users').where({
        openid: this.data.currentUserId
      }).get().then(userRes => {
        this.setData({
          currentUserInfo: userRes.data[0] || {}
        });
      });

      // 检查是否有关联的请求
      if (conv.relatedRequestId) {
        this.setData({
          relatedRequestId: conv.relatedRequestId,
          isRequester: conv.requesterOpenid === this.data.currentUserId
        });

        // 获取请求状态
        db.collection('help_requests').where({
          requestId: conv.relatedRequestId
        }).get().then(reqRes => {
          if (reqRes.data.length > 0) {
            const request = reqRes.data[0];

            // 如果是请求者且状态为active，显示完成按钮
            if (this.data.isRequester && request.status === 'active') {
              this.setData({ showCompleteButton: true });
            }

            // 如果是请求者且有匹配者，显示蜡烛
            if (this.data.isRequester && (request.status === 'matched' || request.status === 'active')) {
              this.setData({ showCandle: true });
              // 加载帮助者列表
              this.loadHelpersList(request);
            }
          }
        });
      }
    }).catch(err => {
      console.error('Load conversation failed:', err);
    });
  },

  /**
   * 加载消息
   */
  loadMessages() {
    const db = wx.cloud.database();

    db.collection('messages').where({
      conversationId: this.data.conversationId
    }).orderBy('createTime', 'asc').get().then(res => {
      this.setData({
        messages: res.data
      });

      if (res.data.length > 0) {
        this.setData({
          lastMessageId: res.data[res.data.length - 1].messageId
        });
      }

      // 加载完消息后开始监听
      this.startMessageWatch();
    }).catch(err => {
      console.error('Load messages failed:', err);
    });
  },

  /**
   * 开始监听新消息
   */
  startMessageWatch() {
    const db = wx.cloud.database();

    // 先停止旧的监听
    this.stopMessageWatch();

    // 使用 watch 实时监听消息变化
    try {
      this.data.messageWatcher = db.collection('messages')
        .where({
          conversationId: this.data.conversationId
        })
        .orderBy('createTime', 'asc')
        .watch({
          onChange: (snapshot) => {
            console.log('Messages changed:', snapshot);

            if (snapshot.docs.length > 0) {
              // 检查是否有新消息（不是自己发送的）
              const newMessages = snapshot.docs;
              const hasNewMessage = newMessages.some(msg => {
                const isNew = !this.data.messages.find(existing => existing.messageId === msg.messageId);
                return isNew && msg.senderId !== this.data.currentUserId;
              });

              this.setData({
                messages: newMessages
              });

              if (newMessages.length > 0) {
                this.setData({
                  lastMessageId: newMessages[newMessages.length - 1].messageId
                });
              }

              // 如果有新消息，标记为已读
              if (hasNewMessage) {
                this.markAsRead();
              }
            }
          },
          onError: (err) => {
            console.error('Message watch error:', err);
            // watch 失败时使用轮询
            this.startMessagePolling();
          }
        });
    } catch (e) {
      console.error('Watch not available, using polling:', e);
      // watch 不可用时使用轮询
      this.startMessagePolling();
    }
  },

  /**
   * 停止监听消息
   */
  stopMessageWatch() {
    if (this.data.messageWatcher) {
      this.data.messageWatcher.close();
      this.setData({ messageWatcher: null });
    }

    if (this.data.pollTimer) {
      clearInterval(this.data.pollTimer);
      this.setData({ pollTimer: null });
    }
  },

  /**
   * 开始轮询消息（备用方案）
   */
  startMessagePolling() {
    this.stopMessageWatch(); // 确保没有重复监听

    const pollTimer = setInterval(() => {
      const db = wx.cloud.database();

      db.collection('messages').where({
        conversationId: this.data.conversationId
      }).orderBy('createTime', 'asc').get().then(res => {
        // 检查是否有新消息
        const newMessages = res.data;
        const hasNewMessage = newMessages.length > this.data.messages.length ||
          newMessages.some(msg => !this.data.messages.find(existing => existing.messageId === msg.messageId));

        if (hasNewMessage) {
          this.setData({
            messages: newMessages
          });

          if (newMessages.length > 0) {
            this.setData({
              lastMessageId: newMessages[newMessages.length - 1].messageId
            });
          }

          // 如果有来自对方的新消息，标记为已读
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.senderId !== this.data.currentUserId) {
            this.markAsRead();
          }
        }
      }).catch(err => {
        console.error('Poll messages failed:', err);
      });
    }, 3000); // 每3秒轮询一次

    this.setData({ pollTimer: pollTimer });
  },

  /**
   * 加载帮助者列表
   */
  loadHelpersList(request) {
    const db = wx.cloud.database();

    if (request.matchedUsers && request.matchedUsers.length > 0) {
      // 获取已匹配的用户信息
      const helpers = [];

      const loadUser = (index) => {
        if (index >= request.matchedUsers.length) {
          this.setData({ helpersList: helpers });
          return;
        }

        db.collection('users').where({
          userId: request.matchedUsers[index]
        }).get().then(userRes => {
          if (userRes.data.length > 0) {
            helpers.push(userRes.data[0]);
          }
          loadUser(index + 1);
        });
      };

      loadUser(0);
    }
  },

  /**
   * 标记为已读
   */
  markAsRead() {
    const db = wx.cloud.database();

    db.collection('conversations').where({
      conversationId: this.data.conversationId
    }).update({
      data: {
        unreadCount: 0
      }
    }).catch(err => {
      console.error('Mark as read failed:', err);
    });
  },

  /**
   * 输入事件
   */
  onInput(e) {
    this.setData({
      inputText: e.detail.value
    });
  },

  /**
   * 发送消息
   */
  sendMessage() {
    const message = this.data.inputText.trim();
    if (!message) return;

    this.setData({
      isTyping: true,
      inputText: ''
    });

    // 调用云函数发送消息
    wx.cloud.callFunction({
      name: 'sendMessage',
      data: {
        conversationId: this.data.conversationId,
        content: message
      }
    }).then(res => {
      console.log('Message sent:', res);

      // 添加消息到列表
      const newMessage = {
        messageId: res.result.messageId,
        conversationId: this.data.conversationId,
        senderId: this.data.currentUserId,
        content: message,
        createTime: new Date()
      };

      this.setData({
        messages: [...this.data.messages, newMessage],
        lastMessageId: res.result.messageId,
        isTyping: false
      });
    }).catch(err => {
      console.error('Send message failed:', err);
      this.setData({ isTyping: false });
      wx.showToast({
        title: '发送失败',
        icon: 'none'
      });
    });
  },

  /**
   * 完成求助请求 - 显示完成弹窗
   */
  completeHelpRequest() {
    if (!this.data.relatedRequestId) return;

    // 显示完成弹窗
    this.setData({
      showCompleteModal: true,
      meetingLocation: '',
      meetingNotes: ''
    });
  },

  /**
   * 关闭完成弹窗
   */
  closeCompleteModal() {
    this.setData({
      showCompleteModal: false
    });
  },

  /**
   * 地点输入
   */
  onLocationInput(e) {
    this.setData({
      meetingLocation: e.detail.value
    });
  },

  /**
   * 备注输入
   */
  onNotesInput(e) {
    this.setData({
      meetingNotes: e.detail.value
    });
  },

  /**
   * 确认完成互助
   */
  confirmComplete() {
    if (!this.data.relatedRequestId) return;

    const { meetingLocation, meetingNotes } = this.data;

    if (!meetingLocation.trim()) {
      wx.showToast({
        title: '请输入协商地点',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '提交中...', mask: true });

    wx.cloud.callFunction({
      name: 'completeHelp',
      data: {
        requestId: this.data.relatedRequestId,
        meetingLocation: meetingLocation,
        meetingNotes: meetingNotes,
        completedConversationId: this.data.conversationId
      }
    }).then(() => {
      wx.hideLoading();
      wx.showToast({
        title: '互助完成！感谢使用',
        icon: 'success',
        duration: 2000
      });

      // 关闭弹窗
      this.setData({
        showCompleteModal: false,
        showCompleteButton: false
      });

      // 延迟后返回首页
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/home/index'
        });
      }, 2000);
    }).catch(err => {
      console.error('Complete help failed:', err);
      wx.hideLoading();
      wx.showToast({
        title: err.result?.error || '操作失败',
        icon: 'none'
      });
    });
  },

  /**
   * 显示帮助者列表
   */
  showHelpersList() {
    this.setData({
      showHelpersModal: true
    });
  },

  /**
   * 关闭帮助者列表
   */
  closeHelpersModal() {
    this.setData({
      showHelpersModal: false
    });
  },

  /**
   * 选择帮助者
   */
  selectHelper(e) {
    const helperOpenid = e.currentTarget.dataset.id;

    // 如果只有一个帮助者，直接关闭弹窗
    if (this.data.helpersList.length <= 1) {
      this.closeHelpersModal();
      return;
    }

    // 创建与该帮助者的单独对话
    // 这里简化处理：实际上同一个对话可能包含多个帮助者
    this.closeHelpersModal();
  },

  /**
   * 返回
   */
  goBack() {
    wx.navigateBack();
  }
});
