// app.js
App({
  onLaunch: function (options) {
    console.log('App Launch', options);

    // 初始化云开发
    this.initCloud();

    // 检查更新
    this.checkUpdate();

    // 初始化用户信息
    this.initUserInfo();
  },

  onShow: function (options) {
    console.log('App Show', options);

    // 检查登录状态
    this.checkLoginStatus();
  },

  onHide: function () {
    console.log('App Hide');
  },

  onError: function (msg) {
    console.error('App Error', msg);
  },

  /**
   * 初始化云开发
   */
  initCloud: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }

    // 初始化云开发环境
    wx.cloud.init({
      env: 'your-env-id', // 请替换为你的云环境ID
      traceUser: true
    });

    console.log('Cloud initialized');
  },

  /**
   * 检查小程序更新
   */
  checkUpdate: function () {
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager();

      updateManager.onCheckForUpdate(function (res) {
        console.log('Has new version:', res.hasUpdate);
      });

      updateManager.onUpdateReady(function () {
        wx.showModal({
          title: '更新提示',
          content: '新版本已经准备好，是否重启应用？',
          success: function (res) {
            if (res.confirm) {
              updateManager.applyUpdate();
            }
          }
        });
      });

      updateManager.onUpdateFailed(function () {
        console.error('New version download failed');
      });
    }
  },

  /**
   * 初始化用户信息
   */
  initUserInfo: function () {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');

    if (token && userInfo) {
      this.globalData.userInfo = userInfo;
      this.globalData.token = token;
      this.globalData.isLoggedIn = true;
    }

    // 初始化位置信息
    const location = wx.getStorageSync('userLocation');
    if (location) {
      this.globalData.location = location;
    }
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus: function () {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');

    this.globalData.isLoggedIn = !!(token && userInfo);

    if (!this.globalData.isLoggedIn) {
      console.log('User not logged in, redirecting to login page');

      // 未登录，跳转到登录页
      wx.reLaunch({
        url: '/pages/Login/index',
        fail: function (err) {
          console.error('Redirect to login page failed:', err);
        }
      });
    } else {
      console.log('User already logged in');

      // 已登录，恢复用户信息
      this.globalData.userInfo = userInfo;
      this.globalData.token = token;

      // 检查位置权限
      this.checkLocationPermission();
    }
  },

  /**
   * 检查位置权限
   */
  checkLocationPermission: function () {
    const that = this;

    wx.getSetting({
      success: function (res) {
        const locationAuth = res.authSetting['scope.userLocation'];

        if (locationAuth === true) {
          // 已授权，获取位置
          that.getCurrentLocation();
        } else if (locationAuth === false) {
          // 已拒绝授权
          console.log('Location permission denied');
          that.globalData.hasLocationPermission = false;
        }
        // undefined 表示未请求过权限
      }
    });
  },

  /**
   * 获取当前位置
   */
  getCurrentLocation: function () {
    const that = this;

    wx.getLocation({
      type: 'gcj02',
      success: function (res) {
        console.log('Get location success:', res);

        const location = {
          latitude: res.latitude,
          longitude: res.longitude,
          accuracy: res.accuracy,
          timestamp: Date.now()
        };

        that.globalData.location = location;
        that.globalData.hasLocationPermission = true;

        // 缓存位置信息（5分钟有效期）
        wx.setStorageSync('userLocation', location);

        // 更新到服务器
        const cloud = require('./utils/cloud.js');
        cloud.updateUserLocation(location).catch(err => {
          console.error('Update user location failed:', err);
        });
      },
      fail: function (err) {
        console.error('Get location failed:', err);
        that.globalData.hasLocationPermission = false;
      }
    });
  },

  /**
   * 退出登录
   */
  logout: function (callback) {
    const that = this;

    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');

    that.globalData.token = null;
    that.globalData.userInfo = null;
    that.globalData.isLoggedIn = false;
    that.globalData.location = null;

    // 跳转到登录页
    wx.reLaunch({
      url: '/pages/Login/index',
      success: function () {
        callback && callback.success && callback.success();
      },
      fail: function (err) {
        callback && callback.fail && callback.fail(err);
      }
    });
  },

  /**
   * 请求位置权限
   */
  requestLocationPermission: function (callback) {
    const that = this;

    wx.getSetting({
      success: function (res) {
        const locationAuth = res.authSetting['scope.userLocation'];

        if (locationAuth === true) {
          // 已授权
          that.getCurrentLocation();
          callback && callback.success && callback.success();
        } else if (locationAuth === false) {
          // 已拒绝，引导用户去设置
          wx.showModal({
            title: '位置权限',
            content: '需要位置权限来显示附近的姐妹，是否前往设置开启？',
            confirmText: '去设置',
            cancelText: '取消',
            success: function (modalRes) {
              if (modalRes.confirm) {
                wx.openSetting({
                  success: function (settingRes) {
                    if (settingRes.authSetting['scope.userLocation']) {
                      that.getCurrentLocation();
                      callback && callback.success && callback.success();
                    } else {
                      callback && callback.cancel && callback.cancel();
                    }
                  }
                });
              } else {
                callback && callback.cancel && callback.cancel();
              }
            }
          });
        } else {
          // 未请求过，直接请求
          wx.authorize({
            scope: 'scope.userLocation',
            success: function () {
              that.getCurrentLocation();
              callback && callback.success && callback.success();
            },
            fail: function () {
              callback && callback.fail && callback.fail();
            }
          });
        }
      }
    });
  },

  globalData: {
    userInfo: null,
    token: null,
    isLoggedIn: false,
    location: null,
    hasLocationPermission: false,
    helpStatus: 'idle' // 'idle' | 'requesting' | 'active'
  }
});
