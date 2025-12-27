// pages/home/index.js
Page({
  data: {
    helpStatus: 'idle', // 'idle' | 'requesting' | 'active'
    showRequestModal: false,
    showTreeHole: false,
    ripples: [],
    helpTypes: [
      { id: 'pad', label: '卫生巾', icon: '🌸' },
      { id: 'tissue', label: '纸巾', icon: '🧻' },
      { id: 'safety', label: '安全陪伴', icon: '🛡️' },
      { id: 'other', label: '其他急需', icon: '❓' }
    ],
    selectedType: null,
    note: '',
    treeHoleStep: 'input', // 'input' | 'processing' | 'result'
    treeHoleInput: '',
    resultImage: '',
    resultRole: '',
    resultText: ''
  },

  onLoad: function (options) {
    console.log('Home page loaded');
  },

  onShow: function () {
    // 页面显示时更新全局状态
    const app = getApp();
    this.setData({
      helpStatus: app.globalData.helpStatus
    });
  },

  // 处理求助按钮点击
  handleStartRequest: function () {
    const { helpStatus } = this.data;

    if (helpStatus === 'idle') {
      this.setData({ showRequestModal: true });
    } else if (helpStatus === 'requesting') {
      wx.showToast({
        title: '长按按钮可以取消请求',
        icon: 'none',
        duration: 2000
      });
    } else if (helpStatus === 'active') {
      wx.showToast({
        title: '互助完成！感谢使用。',
        icon: 'success',
        duration: 3000
      });
      this.setData({ helpStatus: 'idle' });
      getApp().globalData.helpStatus = 'idle';
    }
  },

  // 处理树洞按钮点击
  handleEmotionalClick: function () {
    this.setData({ showTreeHole: true });
  },

  // 提交求助请求
  submitRequest: function (type, note) {
    this.setData({
      showRequestModal: false,
      helpStatus: 'requesting'
    });
    getApp().globalData.helpStatus = 'requesting';

    // 模拟寻找帮助者
    setTimeout(() => {
      this.setData({ helpStatus: 'active' });
      getApp().globalData.helpStatus = 'active';

      wx.showToast({
        title: '附近有姐妹响应了你的请求！',
        icon: 'success',
        duration: 5000,
        mask: true
      });
    }, 5000);
  },

  // 关闭请求模态框
  closeRequestModal: function () {
    this.setData({ showRequestModal: false });
  },

  // 关闭树洞
  closeTreeHole: function () {
    this.setData({
      showTreeHole: false,
      treeHoleStep: 'input',
      treeHoleInput: '',
      resultImage: '',
      resultRole: '',
      resultText: ''
    });
  },

  // 选择帮助类型
  selectHelpType: function (e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ selectedType: type });
  },

  // 输入补充说明
  onNoteInput: function (e) {
    this.setData({ note: e.detail.value });
  },

  // 提交请求
  handleSubmit: function () {
    const { selectedType, note } = this.data;
    if (selectedType) {
      this.submitRequest(selectedType, note);
    }
  },

  // 树洞输入
  onTreeHoleInput: function (e) {
    this.setData({ treeHoleInput: e.detail.value });
  },

  // 发送树洞消息
  sendTreeHole: function () {
    const { treeHoleInput } = this.data;
    if (!treeHoleInput.trim()) return;

    this.setData({ treeHoleStep: 'processing' });

    // 模拟处理延迟
    setTimeout(() => {
      // 简单的关键词匹配
      let result = {
        image: 'bird',
        role: '一只路过的小鸟',
        text: '"每一次跌倒，都是为了学会飞翔。" \n—— 即使翅膀受损，天空依然为你敞开。'
      };

      if (treeHoleInput.includes('累') || treeHoleInput.includes('难过')) {
        result = {
          image: 'flower',
          role: '墙角的小白花',
          text: '"在这喧嚣的世界里，允许自己安静地枯萎一会儿，也是一种生命力。"'
        };
      } else if (treeHoleInput.includes('生气') || treeHoleInput.includes('烦')) {
        result = {
          image: 'rain',
          role: '夏日的雷阵雨',
          text: '"宣泄是自然的韵律，大雨过后，空气会变得格外清新。"'
        };
      }

      this.setData({
        treeHoleStep: 'result',
        resultImage: result.image,
        resultRole: result.role,
        resultText: result.text
      });
    }, 2000);
  },

  // 长按取消请求
  onLongPress: function () {
    if (this.data.helpStatus === 'requesting') {
      wx.showModal({
        title: '取消请求',
        content: '确定要取消当前的求助请求吗？',
        success: (res) => {
          if (res.confirm) {
            this.setData({ helpStatus: 'idle' });
            getApp().globalData.helpStatus = 'idle';
            wx.showToast({
              title: '已取消请求',
              icon: 'success'
            });
          }
        }
      });
    }
  }
});