// pages/profile/index.js
Page({
  data: {
    user: {
      name: 'WarmUser_882',
      joinDays: 12,
      avatar: '👩🏻',
      helpGiven: 5,
      helpReceived: 2,
      resources: ['卫生巾', '纸巾'],
      showOnMap: true
    }
  },

  onLoad: function (options) {
    console.log('Profile page loaded');
  },

  // 切换地图显示状态
  toggleMapVisibility: function () {
    const showOnMap = !this.data.user.showOnMap;
    this.setData({
      'user.showOnMap': showOnMap
    });

    wx.showToast({
      title: showOnMap ? '已开启地图显示' : '已关闭地图显示',
      icon: 'success',
      duration: 1500
    });
  },

  // 导航到设置页面
  goToSettings: function () {
    wx.showToast({
      title: '设置功能开发中',
      icon: 'none',
      duration: 1500
    });
  },

  // 关于我们
  showAbout: function () {
    wx.showModal({
      title: '关于 Girls Help',
      content: 'Girls Help 是一款专为女性用户设计的即时互助小程序，提供安全、便捷的帮助服务。',
      showCancel: false,
      confirmText: '知道了'
    });
  }
});