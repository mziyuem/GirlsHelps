// pages/home/index.js
const cloud = require('../../utils/cloud.js');

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
    resultText: '',
    currentRequestId: null,
    pollTimer: null
  },

  onLoad: function (options) {
    console.log('Home page loaded');
  },

  onUnload: function () {
    // 清除轮询定时器
    if (this.data.pollTimer) {
      clearTimeout(this.data.pollTimer);
    }
  },

  onShow: function () {
    // 页面显示时更新全局状态
    const app = getApp();
    this.setData({
      helpStatus: app.globalData.helpStatus
    });

    // 如果有进行中的请求，恢复轮询
    if (this.data.currentRequestId && this.data.helpStatus === 'requesting') {
      this.pollMatchStatus();
    }
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
      // 完成互助
      this.completeHelp();
    }
  },

  // 处理树洞按钮点击
  handleEmotionalClick: function () {
    this.setData({ showTreeHole: true });
  },

  // 提交求助请求
  submitRequest: function (type, note) {
    const that = this;
    const app = getApp();

    this.setData({
      showRequestModal: false,
      helpStatus: 'requesting'
    });
    app.globalData.helpStatus = 'requesting';

    // 获取当前位置
    wx.getLocation({
      type: 'gcj02',
      success: (locRes) => {
        const location = {
          latitude: locRes.latitude,
          longitude: locRes.longitude,
          accuracy: locRes.accuracy
        };

        // 调用云函数创建求助请求
        cloud.createHelpRequest(type, note, location)
          .then(res => {
            console.log('Help request created:', res);

            // 保存请求ID
            that.setData({
              currentRequestId: res.requestId
            });

            // 更新位置到服务器
            cloud.updateUserLocation(location).catch(err => {
              console.error('Update location failed:', err);
            });

            // 开始轮询匹配状态
            setTimeout(() => {
              that.pollMatchStatus();
            }, 5000);
          })
          .catch(err => {
            console.error('Create help request failed:', err);

            wx.showToast({
              title: err.error || '请求失败，请重试',
              icon: 'none'
            });

            that.setData({ helpStatus: 'idle' });
            app.globalData.helpStatus = 'idle';
          });
      },
      fail: () => {
        wx.showToast({
          title: '获取位置失败，请检查权限设置',
          icon: 'none'
        });

        that.setData({ helpStatus: 'idle' });
        app.globalData.helpStatus = 'idle';
      }
    });
  },

  // 轮询匹配状态
  pollMatchStatus: function () {
    const that = this;
    const app = getApp();

    // 清除之前的定时器
    if (that.data.pollTimer) {
      clearTimeout(that.data.pollTimer);
    }

    if (!that.data.currentRequestId) {
      return;
    }

    // 调用云函数获取状态
    cloud.getHelpRequestStatus(that.data.currentRequestId)
      .then(res => {
        console.log('Help request status:', res);

        if (res.status === 'matched' || res.status === 'active') {
          // 匹配成功
          that.setData({
            helpStatus: 'active'
          });
          app.globalData.helpStatus = 'active';

          wx.showToast({
            title: '附近有姐妹响应了你的请求！',
            icon: 'success',
            duration: 5000,
            mask: true
          });
        } else if (res.status === 'pending') {
          // 继续轮询
          const timer = setTimeout(() => {
            that.pollMatchStatus();
          }, 5000);
          that.setData({ pollTimer: timer });
        } else if (res.status === 'cancelled') {
          // 已取消
          that.setData({
            helpStatus: 'idle',
            currentRequestId: null
          });
          app.globalData.helpStatus = 'idle';
        }
      })
      .catch(err => {
        console.error('Get status failed:', err);
        // 继续轮询
        const timer = setTimeout(() => {
          that.pollMatchStatus();
        }, 5000);
        that.setData({ pollTimer: timer });
      });
  },

  // 完成互助
  completeHelp: function () {
    const that = this;
    const app = getApp();

    if (!that.data.currentRequestId) {
      // 没有请求ID，直接重置状态
      that.setData({
        helpStatus: 'idle'
      });
      app.globalData.helpStatus = 'idle';

      wx.showToast({
        title: '互助完成！感谢使用。',
        icon: 'success',
        duration: 3000
      });
      return;
    }

    // 调用云函数完成互助
    cloud.completeHelp(that.data.currentRequestId)
      .then(res => {
        console.log('Help completed:', res);

        that.setData({
          helpStatus: 'idle',
          currentRequestId: null
        });
        app.globalData.helpStatus = 'idle';

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
          icon: 'none'
        });
      });
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
    } else {
      wx.showToast({
        title: '请选择帮助类型',
        icon: 'none'
      });
    }
  },

  // 树洞输入
  onTreeHoleInput: function (e) {
    this.setData({ treeHoleInput: e.detail.value });
  },

  // 发送树洞消息
  sendTreeHole: function () {
    const that = this;
    const { treeHoleInput } = this.data;

    if (!treeHoleInput.trim()) {
      wx.showToast({
        title: '请输入你想说的话',
        icon: 'none'
      });
      return;
    }

    this.setData({ treeHoleStep: 'processing' });

    // 调用云函数进行情绪支持
    cloud.emotionSupport(treeHoleInput)
      .then(res => {
        console.log('Emotion support result:', res);

        that.setData({
          treeHoleStep: 'result',
          resultImage: res.result.image,
          resultRole: res.result.role,
          resultText: res.result.text
        });
      })
      .catch(err => {
        console.error('Emotion support failed:', err);

        // 即使失败也显示默认回应
        that.setData({
          treeHoleStep: 'result',
          resultImage: 'bird',
          resultRole: '一只路过的小鸟',
          resultText: '"每一次倾诉，都是一次释放。" \n—— 谢谢你愿意分享。'
        });
      });
  },

  // 长按取消请求
  onLongPress: function () {
    const that = this;
    const app = getApp();

    if (this.data.helpStatus === 'requesting') {
      wx.showModal({
        title: '取消请求',
        content: '确定要取消当前的求助请求吗？',
        success: (res) => {
          if (res.confirm) {
            // 清除定时器
            if (that.data.pollTimer) {
              clearTimeout(that.data.pollTimer);
              that.setData({ pollTimer: null });
            }

            // 如果有请求ID，调用云函数取消
            if (that.data.currentRequestId) {
              cloud.cancelHelpRequest(that.data.currentRequestId)
                .then(() => {
                  console.log('Help request cancelled');
                })
                .catch(err => {
                  console.error('Cancel help request failed:', err);
                });
            }

            that.setData({
              helpStatus: 'idle',
              currentRequestId: null
            });
            app.globalData.helpStatus = 'idle';

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
