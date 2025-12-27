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
      { id: 'pad', label: '卫生巾', icon: '🌸' },
      { id: 'tissue', label: '纸巾', icon: '🧻' },
      { id: 'safety', label: '安全陪伴', icon: '🛡️' },
      { id: 'other', label: '其他急需', icon: '❓' }
    ],
    // 求助表单数据
    selectedType: null,
    note: '',
    // 树洞功能状态
    treeHoleStep: 'input', // input(输入)/processing(处理中)/result(结果)
    treeHoleInput: '',
    resultImage: '',
    resultRole: '',
    resultText: '',
    // 求助请求相关
    currentRequestId: null,
    pollTimer: null,
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
    this.clearPollTimer(); // 抽离为独立方法，便于复用
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
        wx.showToast({
          title: '长按按钮可以取消请求',
          icon: 'none',
          duration: this.data.TOAST_DURATION
        });
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
      resultText: ''
    });
  },

  /**
   * 选择帮助类型（核心：仅更新状态，不关闭弹窗）
   * @param {Event} e 点击事件
   */
  selectHelpType(e) {
    e.stopPropagation(); // 阻止冒泡到 overlay
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
    this.setData({ treeHoleInput: e.detail.value?.trim() || '' });
  },

  /**
   * 发送树洞消息（情绪支持）
   */
  sendTreeHole() {
    const { treeHoleInput } = this.data;
    if (!treeHoleInput) {
      wx.showToast({
        title: '请输入你想说的话',
        icon: 'none',
        duration: this.data.TOAST_DURATION
      });
      return;
    }

    // 切换到处理中状态
    this.setData({ treeHoleStep: 'processing' });

    // 调用情绪支持云函数
    cloud.emotionSupport(treeHoleInput)
      .then(res => {
        console.log('Emotion support result:', res);
        this.setData({
          treeHoleStep: 'result',
          resultImage: res.result?.image || '',
          resultRole: res.result?.role || '',
          resultText: res.result?.text || ''
        });
      })
      .catch(err => {
        console.error('Emotion support failed:', err);
        // 失败默认回应（兜底）
        this.setData({
          treeHoleStep: 'result',
          resultImage: 'bird',
          resultRole: '一只路过的小鸟',
          resultText: '"每一次倾诉，都是一次释放。"\n—— 谢谢你愿意分享。'
        });
      });
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
