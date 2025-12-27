// app.js
App({
  onLaunch: function (options) {
    console.log('App Launch', options);
    // 初始化应用
  },
  onShow: function (options) {
    console.log('App Show', options);
  },
  onHide: function () {
    console.log('App Hide');
  },
  onError: function (msg) {
    console.log('App Error', msg);
  },
  globalData: {
    userInfo: null,
    helpStatus: 'idle' // 'idle' | 'requesting' | 'active'
  }
});
