// pages/Login/index.js - 简化版本
const app = getApp();
const cloud = require('../../utils/cloud.js');

Page({
  data: {
    loading: false,
    loadingText: '正在加载...',
    error: '',
    userInfo: null
  },

  onLoad: function (options) {
    console.log('[Login] Page loaded');
    // 简单的测试
    this.setData({
      loadingText: '页面加载成功'
    });
  },

  testButton: function () {
    console.log('[Login] Test button clicked');
    wx.showToast({
      title: '测试成功',
      icon: 'success'
    });
  }
});
