// pages/home/index.js
const cloud = require('../../utils/cloud.js');
const app = getApp(); // 提前获取全局App实例，避免重复调用

Page({
  data: {
    // 求助状态：idle(闲置)/requesting(请求中)/active(匹配成功)
    helpStatus: 'idle',
    // 弹窗控制
    showRequestModal: false,
    showTreeHole: false,
    // 水波纹动画（保留原有）
    ripples: [],
    // 求助类型配置（结构化）
    helpTypes: [
      { id: 'pad', label: '卫生巾' },
      { id: 'tissue', label: '纸巾' },
      { id: 'safety', label: '安全陪伴' },
      { id: 'other', label: '其他急需' }
    ],
    // 求助表单数据
    selectedType: null,
    note: '',
    // 树洞功能状态
    treeHoleStep: 'input', // input(输入)/processing(处理中)/chat(对话中)
    treeHoleInput: '',
    // 对话历史（最近5轮，最多10条消息）
    chatHistory: [],
    isTyping: false,
    resultImage: '',
    resultRole: '',
    resultText: '',
    // 求助请求相关
    currentRequestId: null,
    pollTimer: null,
    // 消息相关
    hasUnreadMessage: false,
    messagePollTimer: null,
    // 常量配置（新增：避免魔法值）
    POLL_INTERVAL: 5000, // 轮询间隔5秒
    TOAST_DURATION: 2000 // 提示框时长
  },

  /**
   * 页面加载生命周期
   */
  onLoad(options) {
    console.log('Home page loaded', options);
  },

  /**
   * 页面卸载生命周期（清理定时器）
   */
  onUnload() {
    this.clearPollTimer(); // 清除求助轮询定时器
    this.stopMessagePolling(); // 清除消息轮询定时器
  },

  /**
   * 页面显示生命周期（恢复状态+轮询）
   */
  onShow() {
    // 更新全局求助状态
    this.setData({
      helpStatus: app.globalData.helpStatus || 'idle' // 兜底默认值
    });

    // 恢复进行中的请求轮询
    if (this.data.currentRequestId && this.data.helpStatus === 'requesting') {
      this.pollMatchStatus();
    }

    // 开始轮询未读消息
    this.startMessagePolling();
  },

  onHide() {
    // 停止轮询未读消息
    this.stopMessagePolling();
  },

  /**
   * 跳转到消息列表
   */
  goToMessages() {
    wx.navigateTo({
      url: '/pages/messages/index'
    });
  },

  /**
   * 检查未读消息（云函数调用）
   */
  checkUnreadMessages() {
    const db = wx.cloud.database();
    const wxContext = wx.cloud.getWXContext();
    const currentOpenid = wxContext.OPENID || '';

    if (!currentOpenid) {
      return;
    }

    db.collection('conversations').where({
      participants: currentOpenid
    }).get().then(res => {
      let hasUnread = false;
      res.data.forEach(conv => {
        if (conv.unreadCount && conv.unreadCount > 0) {
          hasUnread = true;
        }
      });
      this.setData({ hasUnreadMessage: hasUnread });
    }).catch(err => {
      console.error('Check unread messages failed:', err);
    });
  },

  /**
   * 开始轮询未读消息
   */
  startMessagePolling() {
    // 清除旧的定时器
    if (this.data.messagePollTimer) {
      clearInterval(this.data.messagePollTimer);
    }

    // 立即检查一次
    this.checkUnreadMessages();

    // 每5秒检查一次
    const timer = setInterval(() => {
      this.checkUnreadMessages();
    }, 5000);

    this.setData({ messagePollTimer: timer });
  },

  /**
   * 停止轮询未读消息
   */
  stopMessagePolling() {
    if (this.data.messagePollTimer) {
      clearInterval(this.data.messagePollTimer);
      this.setData({ messagePollTimer: null });
    }
  },

  /**
   * 处理求助按钮点击（核心交互）
   */
  handleStartRequest() {
    const { helpStatus } = this.data;

    switch (helpStatus) {
      case 'idle':
        this.setData({ showRequestModal: true });
        break;
      case 'requesting':
        // 也可以打开弹窗发起新请求（会自动取消旧请求）
        this.setData({ showRequestModal: true });
        break;
      case 'active':
        this.completeHelp(); // 完成互助
        break;
      default:
        console.warn('未知的求助状态:', helpStatus);
        break;
    }
  },

  /**
   * 处理树洞按钮点击
   */
  handleEmotionalClick() {
    this.setData({ showTreeHole: true });
  },

  /**
   * 提交求助请求（核心业务逻辑：仅此处关闭弹窗）
   * @param {string} type 求助类型
   * @param {string} note 补充说明
   */
  submitRequest(type, note) {
    // 如果已有正在进行的请求，先自动取消
    if (this.data.currentRequestId && this.data.helpStatus === 'requesting') {
      this.cancelHelpRequestInternal();
    }

    // 首先请求订阅消息权限
    this.requestSubscribeMessage().then(() => {
      // 订阅成功或用户拒绝后继续请求流程
      this.proceedWithRequest(type, note);
    }).catch(() => {
      // 订阅失败也继续请求流程（不阻止用户发起求助）
      this.proceedWithRequest(type, note);
    });
  },

  /**
   * 请求订阅消息权限
   * 模板ID: 7ugkaeDHRleeeT0peCAbcTQv1dSboyU3AWTWaexoSuQ
   */
  requestSubscribeMessage() {
    return new Promise((resolve, reject) => {
      const templateId = '7ugkaeDHRleeeT0peCAbcTQv1dSboyU3AWTWaexoSuQ';

      wx.requestSubscribeMessage({
        tmplIds: [templateId],
        success: (res) => {
          console.log('[SubscribeMessage] Success:', res);
          if (res[templateId] === 'accept') {
            wx.showToast({
              title: '已开启求助通知',
              icon: 'success',
              duration: 1500
            });
            resolve();
          } else {
            // 用户拒绝了订阅
            console.log('[SubscribeMessage] User rejected');
            resolve(); // 仍然继续，不阻止用户
          }
        },
        fail: (err) => {
          console.error('[SubscribeMessage] Failed:', err);
          // 用户可能点击了关闭或其他原因
          resolve(); // 仍然继续，不阻止用户
        }
      });
    });
  },

  /**
   * 继续执行请求流程
   */
  proceedWithRequest(type, note) {
    // 仅发布请求时关闭弹窗，其余操作不关闭
    this.setData({
      showRequestModal: false,
      helpStatus: 'requesting'
    });
    app.globalData.helpStatus = 'requesting';

    // 获取用户位置（前置条件）
    wx.getLocation({
      type: 'gcj02', // 腾讯地图坐标系
      success: (locRes) => {
        const location = {
          latitude: Number(locRes.latitude), // 类型转换兜底
          longitude: Number(locRes.longitude),
          accuracy: Number(locRes.accuracy) || 0
        };

        // 1. 创建求助请求（唯一可正常传信息的入口）
        this.createHelpRequest(type, note, location);
        // 2. 同步更新用户位置
        this.updateUserLocation(location);
      },
      fail: () => {
        // 位置获取失败：回滚状态，但弹窗不关闭（让用户重新操作）
        this.setData({
          helpStatus: 'idle',
          showRequestModal: true // 保持弹窗显示
        });
        app.globalData.helpStatus = 'idle';

        wx.showToast({
          title: '获取位置失败，请检查权限设置',
          icon: 'none',
          duration: this.data.TOAST_DURATION
        });
      }
    });
  },

  /**
   * 创建求助请求（云函数调用：唯一传信息的出口）
   * @param {string} type 求助类型
   * @param {string} note 补充说明
   * @param {object} location 位置信息
   */
  createHelpRequest(type, note, location) {
    cloud.createHelpRequest(type, note, location)
      .then(res => {
        console.log('Help request created:', res);

        // 保存请求ID+启动轮询
        this.setData({ currentRequestId: res.requestId });
        setTimeout(() => this.pollMatchStatus(), this.data.POLL_INTERVAL);
      })
      .catch(err => {
        console.error('Create help request failed:', err);
        // 失败回滚状态，且重新打开弹窗（让用户重试）
        this.setData({ 
          helpStatus: 'idle',
          showRequestModal: true // 保持弹窗显示
        });
        app.globalData.helpStatus = 'idle';

        wx.showToast({
          title: err.error || '请求失败，请重试',
          icon: 'none',
          duration: this.data.TOAST_DURATION
        });
      });
  },

  /**
   * 更新用户位置（抽离为独立方法）
   * @param {object} location 位置信息
   */
  updateUserLocation(location) {
    cloud.updateUserLocation(location)
      .catch(err => console.error('Update location failed:', err));
  },

  /**
   * 轮询求助请求匹配状态
   */
  pollMatchStatus() {
    // 前置校验：无请求ID则终止轮询
    if (!this.data.currentRequestId) return;

    // 清除旧定时器（避免重复）
    this.clearPollTimer();

    // 调用云函数获取状态
    cloud.getHelpRequestStatus(this.data.currentRequestId)
      .then(res => {
        console.log('Help request status:', res);
        this.handlePollResult(res.status);
      })
      .catch(err => {
        console.error('Get status failed:', err);
        // 失败仍继续轮询（容错）
        this.setPollTimer();
      });
  },

  /**
   * 处理轮询结果（状态分发）
   * @param {string} status 请求状态
   */
  handlePollResult(status) {
    switch (status) {
      case 'matched':
      case 'active':
        // 匹配成功：更新状态+提示
        this.setData({ helpStatus: 'active' });
        app.globalData.helpStatus = 'active';

        wx.showToast({
          title: '附近有姐妹响应了你的请求！',
          icon: 'success',
          duration: 5000,
          mask: true
        });
        break;
      case 'pending':
        // 等待中：继续轮询
        this.setPollTimer();
        break;
      case 'cancelled':
        // 已取消：重置状态
        this.setData({
          helpStatus: 'idle',
          currentRequestId: null
        });
        app.globalData.helpStatus = 'idle';
        break;
      default:
        console.warn('未知的请求状态:', status);
        this.setPollTimer(); // 未知状态仍容错轮询
        break;
    }
  },

  /**
   * 设置轮询定时器（抽离为独立方法）
   */
  setPollTimer() {
    const timer = setTimeout(() => this.pollMatchStatus(), this.data.POLL_INTERVAL);
    this.setData({ pollTimer: timer });
  },

  /**
   * 清除轮询定时器（抽离为独立方法）
   */
  clearPollTimer() {
    if (this.data.pollTimer) {
      clearTimeout(this.data.pollTimer);
      this.setData({ pollTimer: null });
    }
  },

  /**
   * 完成互助（核心业务）
   */
  completeHelp() {
    // 无请求ID：直接重置状态
    if (!this.data.currentRequestId) {
      this.resetHelpStatus();
      wx.showToast({
        title: '互助完成！感谢使用。',
        icon: 'success',
        duration: 3000
      });
      return;
    }

    // 调用云函数完成互助
    cloud.completeHelp(this.data.currentRequestId)
      .then(res => {
        console.log('Help completed:', res);
        this.resetHelpStatus(); // 重置状态

        wx.showToast({
          title: res.message || '互助完成！感谢使用。',
          icon: 'success',
          duration: 3000
        });
      })
      .catch(err => {
        console.error('Complete help failed:', err);
        wx.showToast({
          title: err.error || '操作失败',
          icon: 'none',
          duration: this.data.TOAST_DURATION
        });
      });
  },

  /**
   * 重置求助状态（抽离为独立方法）
   */
  resetHelpStatus() {
    this.clearPollTimer(); // 清除定时器
    this.setData({
      helpStatus: 'idle',
      currentRequestId: null
    });
    app.globalData.helpStatus = 'idle';
  },

  /**
   * 阻止事件冒泡（用于input等元素）
   */
  stopPropagation() {
    // 空函数，仅用于阻止事件冒泡
  },

  /**
   * 关闭请求模态框（点击关闭按钮时触发）
   */
  closeRequestModal() {
    // 直接关闭弹窗
    this.setData({ showRequestModal: false });

    // 可选：清空表单数据
    this.setData({
      selectedType: null,
      note: ''
    });
  },

  /**
   * 关闭树洞（仅重置树洞状态，不退出页面）
   */
  closeTreeHole() {
    this.setData({
      showTreeHole: false,
      treeHoleStep: 'input',
      treeHoleInput: '',
      resultImage: '',
      resultRole: '',
      resultText: '',
      lastMessageId: ''
    });
  },

  /**
   * 选择帮助类型（核心：仅更新状态，不关闭弹窗）
   * @param {Event} e 点击事件
   */
  selectHelpType(e) {
    const type = e.currentTarget.dataset.type;
    // 仅更新选中状态，绝对不关闭弹窗
    this.setData({ selectedType: type });
    // 可选：增加反馈，提示用户已选中
    wx.showToast({
      title: `已选择：${this.data.helpTypes.find(item => item.id === type)?.label}`,
      icon: 'none',
      duration: 1000
    });
  },

  /**
   * 输入求助补充说明（核心：仅更新内容，不关闭弹窗）
   * @param {Event} e 输入事件
   */
  onNoteInput(e) {
    // 仅更新输入内容，绝对不关闭弹窗
    this.setData({ note: e.detail.value?.trim() || '' });
  },

  /**
   * 提交求助表单（校验+提交：唯一关闭弹窗的入口）
   */
  handleSubmit() {
    const { selectedType, note } = this.data;

    // 至少要有一个不为空
    if (!selectedType && !note) {
      wx.showToast({
        title: '请至少选择类型或填写说明',
        icon: 'none',
        duration: this.data.TOAST_DURATION
      });
      return; // 阻止提交
    }
  
    // 允许空 type 或 note，但不能同时为空
    this.submitRequest(selectedType || '', note || '');
  },

  /**
   * 树洞输入事件
   * @param {Event} e 输入事件
   */
  onTreeHoleInput(e) {
    this.setData({ treeHoleInput: e.detail.value });
  },

  /**
   * 发送树洞消息（DeepSeek AI对话）
   */
  sendTreeHole() {
    const { treeHoleInput, chatHistory, isTyping } = this.data;
    const message = treeHoleInput.trim();

    if (!message) {
      wx.showToast({
        title: '请输入你想说的话',
        icon: 'none',
        duration: this.data.TOAST_DURATION
      });
      return;
    }

    if (isTyping) {
      return;
    }

    // 生成消息ID
    const messageId = `msg-${Date.now()}`;

    // 添加用户消息到历史
    const newHistory = [
      ...chatHistory,
      { role: 'user', content: message, id: messageId }
    ];

    // 限制历史记录为10条消息（5轮对话）
    const limitedHistory = newHistory.slice(-10);

    // 清空输入框，切换到对话状态
    this.setData({
      chatHistory: limitedHistory,
      treeHoleInput: '',
      treeHoleStep: 'chat',
      isTyping: true,
      lastMessageId: messageId
    });

    // 调用DeepSeek云函数
    this.callDeepSeek(message, limitedHistory);
  },

  /**
   * 调用DeepSeek云函数
   * @param {string} message 用户消息
   * @param {Array} history 对话历史
   */
  callDeepSeek(message, history) {
    wx.cloud.callFunction({
      name: 'deepSeekChat',
      data: {
        message: message,
        history: history
      }
    })
    .then(res => {
      const reply = res.result.reply || '感谢你的分享。你的感受很重要，我一直在听。';

      // 生成AI消息ID
      const aiMessageId = `msg-${Date.now()}`;

      // 添加AI回复到历史
      const newHistory = [
        ...this.data.chatHistory,
        { role: 'assistant', content: reply, id: aiMessageId }
      ];

      this.setData({
        chatHistory: newHistory,
        isTyping: false,
        treeHoleStep: 'chat',
        lastMessageId: aiMessageId
      });
    })
    .catch(err => {
      console.error('DeepSeek error:', err);

      // 失败兜底回复
      const fallbackReply = '我听见你了。你的感受很重要，想说的话都可以继续告诉我。';

      const aiMessageId = `msg-${Date.now()}`;

      const newHistory = [
        ...this.data.chatHistory,
        { role: 'assistant', content: fallbackReply, id: aiMessageId }
      ];

      this.setData({
        chatHistory: newHistory,
        isTyping: false,
        lastMessageId: aiMessageId
      });

      wx.showToast({
        title: '回复稍慢，但我在听',
        icon: 'none'
      });
    });
  },

  /**
   * 重新开始对话
   */
  resetChat() {
    wx.showModal({
      title: '重新开始',
      content: '确定要清空对话历史重新开始吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            chatHistory: [],
            treeHoleStep: 'input',
            treeHoleInput: '',
            isTyping: false,
            lastMessageId: ''
          });
        }
      }
    });
  },

  /**
   * 内部取消求助请求（静默取消，不显示提示）
   */
  cancelHelpRequestInternal() {
    // 清除定时器
    this.clearPollTimer();

    // 调用云函数取消请求（有ID时）
    if (this.data.currentRequestId) {
      cloud.cancelHelpRequest(this.data.currentRequestId)
        .then(() => console.log('Help request auto-cancelled before new request'))
        .catch(err => console.error('Auto-cancel help request failed:', err));
    }

    // 重置状态（静默，不显示提示）
    this.setData({
      helpStatus: 'idle',
      currentRequestId: null
    });
    app.globalData.helpStatus = 'idle';
  },

  /**
   * 长按取消求助请求
   */
  onLongPress() {
    if (this.data.helpStatus !== 'requesting') return;

    wx.showModal({
      title: '取消请求',
      content: '确定要取消当前的求助请求吗？',
      success: (res) => {
        if (res.confirm) {
          this.cancelHelpRequest(); // 执行取消逻辑
        }
      }
    });
  },

  /**
   * 取消求助请求（核心逻辑）
   */
  cancelHelpRequest() {
    // 清除定时器
    this.clearPollTimer();

    // 调用云函数取消请求（有ID时）
    if (this.data.currentRequestId) {
      cloud.cancelHelpRequest(this.data.currentRequestId)
        .then(() => console.log('Help request cancelled'))
        .catch(err => console.error('Cancel help request failed:', err));
    }

    // 重置状态
    this.resetHelpStatus();

    wx.showToast({
      title: '已取消请求',
      icon: 'success',
      duration: this.data.TOAST_DURATION
    });
  }
});
