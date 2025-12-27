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
      resources: [],
      showOnMap: true
    },
    loading: true
  },

  onLoad: function (options) {
    console.log('Profile page loaded');
    this.loadUserProfile();
  },

  onShow: function () {
    // 页面显示时刷新数据
    if (!this.data.loading) {
      this.loadUserProfile();
    }
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

        that.setData({
          user: {
            name: res.user.nickName || '姐妹',
            joinDays: res.user.joinDays || 0,
            avatar: res.user.avatar || '👩🏻',
            helpGiven: res.user.stats.helpGiven || 0,
            helpReceived: res.user.stats.helpReceived || 0,
            resources: res.user.resources || [],
            showOnMap: res.user.showOnMap !== false
          },
          loading: false
        });
      })
      .catch(err => {
        console.error('Get user profile failed:', err);

        // 使用本地缓存的数据
        const userInfo = wx.getStorageSync('userInfo');

        that.setData({
          user: {
            name: userInfo?.nickName || '姐妹',
            joinDays: userInfo?.joinDays || 0,
            avatar: '👩🏻',
            helpGiven: userInfo?.stats?.helpGiven || 0,
            helpReceived: userInfo?.stats?.helpReceived || 0,
            resources: userInfo?.resources || [],
            showOnMap: true
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
   * 编辑可提供的资源
   */
  editResources: function () {
    const that = this;
    const currentResources = this.data.user.resources;

    // 可选资源列表
    const allResources = ['卫生巾', '纸巾', '暖宝宝', '热水', '充电宝', '巧克力', '雨伞', '充电线'];

    // 构建选项数组
    const items = allResources.map(r => {
      const isChecked = currentResources.includes(r);
      return {
        name: (isChecked ? '✓ ' : '') + r,
        value: r,
        checked: isChecked
      };
    });

    // 显示选择器
    wx.showActionSheet({
      itemList: items.map(item => item.name),
      success: function (res) {
        // 简单处理：单选切换
        const selected = allResources[res.tapIndex];

        // 检查是否已存在
        const index = currentResources.indexOf(selected);

        let newResources;
        if (index > -1) {
          // 已存在，移除
          newResources = currentResources.filter(r => r !== selected);
        } else {
          // 不存在，添加
          newResources = [...currentResources, selected];
        }

        // 更新资源
        that.updateResources(newResources);
      }
    });
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
        wx.showToast({
          title: resources.length > 0
            ? `可提供: ${resources.join('、')}`
            : '未选择资源',
          icon: 'success',
          duration: 2000
        });
      })
      .catch(err => {
        console.error('Update resources failed:', err);

        wx.showToast({
          title: '更新失败',
          icon: 'none'
        });
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
      title: '关于 Girls Help',
      content: 'Girls Help 是一款专为女性用户设计的即时互助小程序，提供安全、便捷的帮助服务。\n\n版本：1.0.0',
      showCancel: false,
      confirmText: '知道了'
    });
  }
});
