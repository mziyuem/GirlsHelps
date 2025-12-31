// pages/profile/index.js
const cloud = require('../../utils/cloud.js');

Page({
  data: {
    user: {
      name: '',
      joinDays: 0,
      avatar: '👩🏻',
      helpGiven: 0,
      helpReceived: 0,
      resources: [], // 确保是数组
      showOnMap: true,
      ip: '' // 添加IP字段
    },
    loading: true,
    editingNickname: false, // 是否正在编辑昵称
    editingIP: false, // 是否正在编辑IP
    nicknameInput: '', // 昵称输入框值
    ipInput: '', // IP输入框值
    showResourceModal: false, // 是否显示资源选择弹窗
    showEditButton: true, // 编辑按钮始终显示
    tempResources: [], // 临时选择的资源（弹窗中使用）
    customResourceInput: '', // 自定义资源输入框值
    presetResources: ['卫生巾', '雨伞', '巧克力', '卫生纸', '暖宝宝', '创口贴', '充电宝', '充电线'] // 预设资源列表
  },

  onLoad: function (options) {
    console.log('Profile page loaded');
    console.log('初始用户数据:', this.data.user);
    console.log('初始resources:', this.data.user.resources, '类型:', typeof this.data.user.resources, '长度:', this.data.user.resources?.length);

    // 确保编辑按钮始终可见 - 强制设置数据
    this.setData({
      showEditButton: true,
      user: {
        ...this.data.user,
        resources: Array.isArray(this.data.user.resources) ? this.data.user.resources : []
      }
    });

    this.loadUserProfile();
  },

  onShow: function () {
    console.log('Profile page onShow, 编辑按钮状态:', this.data.showEditButton);
    console.log('当前用户资源:', this.data.user.resources);

    // 页面显示时刷新数据
    if (!this.data.loading) {
      this.loadUserProfile();
    }

    // 确保编辑按钮始终可见
    this.setData({
      showEditButton: true
    });
  },

  /**
   * 加载用户资料
   */
  loadUserProfile: function () {
    const that = this;
    that.setData({ loading: true });

    cloud.getUserProfile()
      .then(res => {
        console.log('User profile:', res);

        const userResources = Array.isArray(res.user.resources) ? res.user.resources : [];
        console.log('获取到的用户资源:', userResources, '类型:', typeof userResources, '长度:', userResources.length);

        that.setData({
          user: {
            name: res.user.nickName || '姐妹',
            joinDays: res.user.joinDays || 0,
            avatar: res.user.avatar || '👩🏻',
            helpGiven: res.user.stats.helpGiven || 0,
            helpReceived: res.user.stats.helpReceived || 0,
            resources: userResources,
            showOnMap: res.user.showOnMap !== false,
            ip: res.user.ip || '' // 添加IP信息
          },
          loading: false,
          showEditButton: true // 确保编辑按钮始终显示
        });

        console.log('设置后的用户资源:', that.data.user.resources);
        console.log('编辑按钮状态:', that.data.showEditButton);
      })
      .catch(err => {
        console.error('Get user profile failed:', err);

        // 使用本地缓存的数据
        const userInfo = wx.getStorageSync('userInfo');
        const cachedResources = Array.isArray(userInfo?.resources) ? userInfo.resources : [];
        console.log('使用缓存数据，缓存资源:', cachedResources);

        that.setData({
          user: {
            name: userInfo?.nickName || '姐妹',
            joinDays: userInfo?.joinDays || 0,
            avatar: '👩🏻',
            helpGiven: userInfo?.stats?.helpGiven || 0,
            helpReceived: userInfo?.stats?.helpReceived || 0,
            resources: cachedResources,
            showOnMap: true,
            ip: userInfo?.ip || '' // 添加IP信息
          },
          loading: false
        });

        wx.showToast({
          title: '加载失败，显示缓存数据',
          icon: 'none'
        });
      });
  },

  /**
   * 开始编辑昵称
   */
  startEditNickname: function () {
    this.setData({
      editingNickname: true,
      nicknameInput: this.data.user.name
    });
  },

  /**
   * 保存昵称（失去焦点时自动保存）
   */
  saveNickname: function () {
    const that = this;
    const newNickname = this.data.nicknameInput.trim();

    if (!newNickname) {
      wx.showToast({
        title: '昵称不能为空',
        icon: 'none'
      });
      // 恢复原来的昵称
      this.setData({
        nicknameInput: this.data.user.name
      });
      return;
    }

    if (newNickname === this.data.user.name) {
      // 昵称没有变化，直接退出编辑模式
      this.setData({
        editingNickname: false,
        nicknameInput: ''
      });
      return;
    }

    // 调用云函数更新昵称
    cloud.updateUserInfo({ nickName: newNickname })
      .then(res => {
        // 更新本地状态
        that.setData({
          'user.name': newNickname,
          editingNickname: false,
          nicknameInput: ''
        });

        // 更新全局用户信息
        const app = getApp();
        if (app.globalData.userInfo) {
          app.globalData.userInfo.nickName = newNickname;
          wx.setStorageSync('userInfo', app.globalData.userInfo);
        }
      })
      .catch(err => {
        console.error('Update nickname failed:', err);
        wx.showToast({
          title: '更新失败',
          icon: 'none'
        });
        // 恢复原来的昵称
        this.setData({
          nicknameInput: this.data.user.name
        });
      });
  },

  /**
   * 开始编辑IP
   */
  startEditIP: function () {
    this.setData({
      editingIP: true,
      ipInput: this.data.user.ip || ''
    });
  },

  /**
   * 保存IP（失去焦点时自动保存）
   */
  saveIP: function () {
    const that = this;
    const newIP = this.data.ipInput.trim();

    // IP可以为空
    if (newIP === this.data.user.ip) {
      // IP没有变化，直接退出编辑模式
      this.setData({
        editingIP: false,
        ipInput: ''
      });
      return;
    }

    // 调用云函数更新IP
    cloud.updateUserInfo({ ip: newIP })
      .then(res => {
        // 更新本地状态
        that.setData({
          'user.ip': newIP,
          editingIP: false,
          ipInput: ''
        });

        // 更新全局用户信息
        const app = getApp();
        if (app.globalData.userInfo) {
          app.globalData.userInfo.ip = newIP;
          wx.setStorageSync('userInfo', app.globalData.userInfo);
        }
      })
      .catch(err => {
        console.error('Update IP failed:', err);
        wx.showToast({
          title: '更新失败',
          icon: 'none'
        });
        // 恢复原来的IP
        this.setData({
          ipInput: this.data.user.ip || ''
        });
      });
  },

  /**
   * 昵称输入框变化
   */
  onNicknameInput: function (e) {
    this.setData({
      nicknameInput: e.detail.value
    });
  },

  /**
   * IP输入框变化
   */
  onIPInput: function (e) {
    this.setData({
      ipInput: e.detail.value
    });
  },

  /**
   * 切换地图显示状态
   */
  toggleMapVisibility: function () {
    const that = this;
    const newShowOnMap = !this.data.user.showOnMap;

    // 先更新本地状态
    that.setData({
      'user.showOnMap': newShowOnMap
    });

    // 调用云函数更新
    cloud.updatePrivacySetting(newShowOnMap)
      .then(res => {
        wx.showToast({
          title: newShowOnMap ? '已开启地图显示' : '已关闭地图显示',
          icon: 'success'
        });
      })
      .catch(err => {
        console.error('Update privacy failed:', err);

        // 失败时恢复原状态
        that.setData({
          'user.showOnMap': !newShowOnMap
        });

        wx.showToast({
          title: '设置失败',
          icon: 'none'
        });
      });
  },

  /**
   * 编辑可提供的资源 - 显示弹窗
   */
  editResources: function () {
    console.log('编辑资源按钮被点击');
    console.log('当前用户资源:', this.data.user.resources);
    console.log('资源类型:', typeof this.data.user.resources);
    console.log('资源长度:', this.data.user.resources?.length);

    // 初始化临时资源列表为当前用户资源
    const currentResources = Array.isArray(this.data.user.resources) ? this.data.user.resources : [];
    console.log('处理后的当前资源:', currentResources);

    this.setData({
      showResourceModal: true,
      tempResources: [...currentResources],
      customResourceInput: ''
    });

    console.log('弹窗状态设置为:', this.data.showResourceModal);
    console.log('临时资源设置为:', this.data.tempResources);
    console.log('预设资源列表:', this.data.presetResources);

    // 延迟检查弹窗是否正确显示
    setTimeout(() => {
      console.log('弹窗显示状态检查:', this.data.showResourceModal);
      console.log('临时资源长度:', this.data.tempResources.length);
    }, 100);
  },

  /**
   * 关闭资源选择弹窗
   */
  closeResourceModal: function () {
    this.setData({
      showResourceModal: false,
      tempResources: [],
      customResourceInput: ''
    });
  },

  /**
   * 切换预设资源选择状态
   */
  togglePresetResource: function (e) {
    console.log('点击预设资源:', e.currentTarget.dataset.resource);
    const resource = e.currentTarget.dataset.resource;
    const tempResources = [...this.data.tempResources];
    const index = tempResources.indexOf(resource);

    console.log('当前临时资源:', tempResources);
    console.log('资源是否存在于列表中:', index > -1);

    if (index > -1) {
      // 已选择，移除
      tempResources.splice(index, 1);
      console.log('移除资源:', resource);
    } else {
      // 未选择，添加
      tempResources.push(resource);
      console.log('添加资源:', resource);
    }

    console.log('更新后的临时资源:', tempResources);
    this.setData({
      tempResources: tempResources
    });

    // 强制更新视图
    this.setData({
      tempResourcesLength: tempResources.length
    });
  },

  /**
   * 移除已选择的资源
   */
  removeResource: function (e) {
    const resource = e.currentTarget.dataset.resource;
    const tempResources = this.data.tempResources.filter(r => r !== resource);

    this.setData({
      tempResources: tempResources
    });
  },

  /**
   * 自定义资源输入变化
   */
  onCustomInput: function (e) {
    this.setData({
      customResourceInput: e.detail.value
    });
  },

  /**
   * 添加自定义资源
   */
  addCustomResource: function () {
    const customResource = this.data.customResourceInput.trim();

    if (!customResource) {
      wx.showToast({
        title: '请输入资源名称',
        icon: 'none'
      });
      return;
    }

    // 检查是否已存在
    if (this.data.tempResources.includes(customResource)) {
      wx.showToast({
        title: '该资源已添加',
        icon: 'none'
      });
      return;
    }

    // 检查是否在预设资源中
    if (this.data.presetResources.includes(customResource)) {
      wx.showToast({
        title: '该资源已存在于预设列表',
        icon: 'none'
      });
      return;
    }

    // 添加到临时资源列表
    const tempResources = [...this.data.tempResources, customResource];
    this.setData({
      tempResources: tempResources,
      customResourceInput: '' // 清空输入框
    });
  },

  /**
   * 确认资源选择
   */
  confirmResourceSelection: function () {
    const selectedResources = [...this.data.tempResources];

    // 关闭弹窗
    this.setData({
      showResourceModal: false
    });

    // 更新资源
    this.updateResources(selectedResources);
  },

  /**
   * 更新资源
   */
  updateResources: function (resources) {
    const that = this;

    // 先更新本地状态
    that.setData({
      'user.resources': resources
    });

    // 调用云函数更新
    cloud.updateUserResources(resources)
      .then(res => {
        const message = resources.length > 0
          ? `已选择 ${resources.length} 项资源`
          : '已清除所有资源';

        wx.showToast({
          title: message,
          icon: 'success',
          duration: 2000
        });

        // 更新全局用户信息
        const app = getApp();
        if (app.globalData.userInfo) {
          app.globalData.userInfo.resources = resources;
          wx.setStorageSync('userInfo', app.globalData.userInfo);
        }

        // 如果用户选择了资源，引导订阅求助通知
        if (resources.length > 0) {
          that.requestHelpNotificationSubscription();
        }
      })
      .catch(err => {
        console.error('Update resources failed:', err);

        // 失败时恢复原状态
        that.setData({
          'user.resources': this.data.user.resources
        });

        wx.showToast({
          title: '更新失败',
          icon: 'none'
        });
      });
  },

  /**
   * 请求订阅求助通知
   * 当用户设置可提供资源后，引导其订阅求助通知
   */
  requestHelpNotificationSubscription: function () {
    const templateId = '7ugkaeDHRleeeT0peCAbcTQv1dSboyU3AWTWaexoSuQ';

    wx.showModal({
      title: '开启求助通知',
      content: '当附近有姐妹需要您提供的帮助时，是否接收微信消息通知？',
      confirmText: '开启通知',
      cancelText: '暂不需要',
      success: (res) => {
        if (res.confirm) {
          wx.requestSubscribeMessage({
            tmplIds: [templateId],
            success: (subRes) => {
              console.log('[Subscribe] Result:', subRes);
              if (subRes[templateId] === 'accept') {
                wx.showToast({
                  title: '已开启求助通知',
                  icon: 'success',
                  duration: 2000
                });
              } else {
                wx.showToast({
                  title: '您可以在设置中随时开启',
                  icon: 'none',
                  duration: 2000
                });
              }
            },
            fail: (err) => {
              console.error('[Subscribe] Failed:', err);
              // 用户拒绝或取消，不阻止流程
            }
          });
        }
      }
    });
  },

  /**
   * 清除所有资源
   */
  clearResources: function () {
    const that = this;

    wx.showModal({
      title: '确认清除',
      content: '确定要清除所有可提供的资源吗？',
      success: function (res) {
        if (res.confirm) {
          that.updateResources([]);
        }
      }
    });
  },

  /**
   * 阻止事件冒泡
   */
  stopPropagation: function () {
    // 空函数，仅用于阻止事件冒泡
  },

  /**
   * 刷新数据
   */
  refreshData: function () {
    this.loadUserProfile();
  },

  /**
   * 导航到设置页面
   */
  goToSettings: function () {
    wx.showToast({
      title: '设置功能开发中',
      icon: 'none',
      duration: 1500
    });
  },

  /**
   * 关于我们
   */
  showAbout: function () {
    wx.showModal({
      title: '关于 她邻 LunAId',
      content: '她邻LunAId 是一款专为女性用户设计的即时互助小程序，提供安全、便捷的帮助服务。\n\n版本：1.0.0',
      showCancel: false,
      confirmText: '知道了'
    });
  }
});
