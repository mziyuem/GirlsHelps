// pages/Login/index.js
const app = getApp();
const cloud = require('../../utils/cloud.js');

Page({
  data: {
    loading: false,
    loadingText: '正在登录...',
    error: '',
    isLoggedIn: false,
    userInfo: null,
    hasLocationPermission: false
  },

  onLoad: function (options) {
    console.log('Login page loaded');

    // 检查是否已经登录
    this.checkLoginStatus();
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    const autoLogin = wx.getStorageSync('autoLogin');

    if (token && userInfo && autoLogin === true) {
      // 已登录，直接跳转到主页（自动登录）
      console.log('Already logged in, auto redirect to home');

      // 更新全局数据
      app.globalData.userInfo = userInfo;
      app.globalData.token = token;
      app.globalData.isLoggedIn = true;

      // 延迟一点跳转，让全局数据更新完成
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/home/index',
          fail: function (err) {
            console.error('Redirect to home failed:', err);
            // 如果switchTab失败，尝试使用reLaunch
            wx.reLaunch({
              url: '/pages/home/index'
            });
          }
        });
      }, 100);
    } else {
      // 未登录，自动触发登录流程
      console.log('Not logged in, starting login flow');
      this.setData({
        isLoggedIn: false,
        userInfo: null
      });
    }
  },
  // checkLoginStatus: function () {
  //   const token = wx.getStorageSync('token');
  //   const userInfo = wx.getStorageSync('userInfo');
  //   const autoLogin = wx.getStorageSync('autoLogin');

  //   if (token && userInfo && autoLogin === true) {
      // 已登录，直接跳转到主页（自动登录）
      // console.log('Already logged in, auto redirect to home');

      // // 更新全局数据
      // app.globalData.userInfo = userInfo;
      // app.globalData.token = token;
      // app.globalData.isLoggedIn = true;

      // // 检查位置权限
      // this.checkLocationPermission();

      // // 延迟一点跳转，让全局数据更新完成
      // setTimeout(() => {
      //   wx.switchTab({
      //     url: '/pages/home/index',
      //     fail: function (err) {
      //       console.error('Redirect to home failed:', err);
      //       // 如果switchTab失败，尝试使用reLaunch
      //       wx.reLaunch({
      //         url: '/pages/home/index'
      //       });
      //     }
      //   });
      // }, 100);
      
  //     console.log('已有登录信息，但取消自动登录');
  //     this.setData({ isLoggedIn: true, userInfo }); // 仅更新页面状态，不跳转
  //     app.globalData.isLoggedIn = true; // 可选：保留全局登录状态标记
  //   } else {
  //     // 未登录，自动触发登录流程
  //     console.log('Not logged in, starting login flow');
  //     // this.autoLogin();
  //   }
  // },

  /**
   * 自动登录
   */
  autoLogin: function () {
    console.log('Auto login triggered');
    // this.handleLogin();
  },
  // 手动登录
  onLoginTap() {
    if (this.data.loading) return;

    this.setData({
      loading: true,
      loadingText: '正在获取用户信息...'
    });

    // 获取微信登录code
    wx.login({
      success: (loginRes) => {
        if (!loginRes.code) {
          this.handleError('获取登录凭证失败');
          return;
        }

        // 获取用户信息
        wx.getUserProfile({
          desc: '用于完善用户资料',
          success: (profileRes) => {
            this.setData({ loadingText: '正在登录...' });
            this.sendToServer(loginRes.code, profileRes.userInfo);
          },
          fail: (err) => {
            // 用户拒绝授权用户信息，使用匿名登录
            this.setData({ loadingText: '正在匿名登录...' });
            this.sendToServer(loginRes.code, {
              nickName: '姐妹',
              avatarUrl: '',
              isAnonymous: true
            });
          }
        });
      },
      fail: (err) => {
        console.error('wx.login failed:', err);
        this.handleError('登录失败，请重试');
      }
    });
  },
  /**
   * 进入应用（已登录状态下调用）
   */
  enterApp: function () {
    // 检查是否有位置权限，没有则提示
    if (!this.data.hasLocationPermission) {
      wx.showModal({
        title: '温馨提示',
        content: '为了更好的使用体验，建议您开启位置权限，这样可以看到附近的姐妹。',
        confirmText: '去设置',
        cancelText: '暂不',
        success: function (res) {
          if (res.confirm) {
            wx.openSetting();
          } else {
            // 用户选择暂不，直接进入应用
            wx.switchTab({
              url: '/pages/home/index',
              fail: function (err) {
                console.error('Redirect to home failed:', err);
                wx.reLaunch({
                  url: '/pages/home/index'
                });
              }
            });
          }
        }
      });
    } else {
      // 有位置权限，直接进入应用
      wx.switchTab({
        url: '/pages/home/index',
        fail: function (err) {
          console.error('Redirect to home failed:', err);
          wx.reLaunch({
            url: '/pages/home/index'
          });
        }
      });
    }
  },

  /**
   * 处理登录
   */
  // handleLogin: function () {
  //   const that = this;

  //   this.setData({
  //     loading: true,
  //     loadingText: '正在登录...',
  //     error: ''
  //   });

  //   // 第一步：获取微信登录code
  //   wx.login({
  //     success: function (loginRes) {
  //       console.log('wx.login success:', loginRes);

  //       if (loginRes.code) {
  //         // 第二步：获取用户信息（需要用户授权）
  //         that.getUserProfile(loginRes.code);
  //       } else {
  //         that.handleError('获取登录凭证失败');
  //       }
  //     },
  //     fail: function (err) {

  //       console.error('wx.login failed:', err);
  //       that.handleError('登录失败，请重试');
  //     }
  //   });
  // },

  /**
   * 获取用户信息
   */
  // getUserProfile: function (code) {
  //   const that = this;

  //   this.setData({
  //     loadingText: '正在获取用户信息...'
  //   });

  //   // 使用 getUserProfile 获取用户信息（需要用户授权）
  //   wx.getUserProfile({
  //     desc: '用于完善用户资料',
  //     success: function (profileRes) {
  //       console.log('getUserProfile success:', profileRes);

  //       const userInfo = profileRes.userInfo;

  //       // 第三步：发送到服务器
  //       that.sendToServer(code, userInfo);
  //     },
  //     fail: function (err) {
  //       console.error('getUserProfile failed:', err);

  //       // 用户拒绝授权用户信息，使用匿名登录
  //       if (err.errMsg.includes('cancel')) {
  //         that.setData({
  //           loadingText: '正在匿名登录...'
  //         });
  //         that.sendToServer(code, {
  //           nickName: '姐妹',
  //           avatarUrl: '',
  //           isAnonymous: true
  //         });
  //       } else {
  //         that.handleError('获取用户信息失败');
  //       }
  //     }
  //   });
  // },

  /**
   * 发送到服务器（调用云函数）
   */
  sendToServer: function (code, userInfo) {
    const that = this;

    this.setData({
      loadingText: '正在连接服务器...'
    });

    // 调用云函数登录
    cloud.login(code, userInfo)
      .then(res => {
        console.log('Login success:', res);

        // 保存token和用户信息
        wx.setStorageSync('token', res.token);
        wx.setStorageSync('userInfo', res.userInfo);
        wx.setStorageSync('autoLogin', true); // 启用自动登录

        // 更新全局数据
        app.globalData.userInfo = res.userInfo;
        app.globalData.token = res.token;
        app.globalData.isLoggedIn = true;

        // 请求位置权限
        that.requestLocationPermission();
      })
    .catch(err => {
      console.error('Login failed:', err);
      that.handleError('登录失败，请稍后重试');
    });
  },

  /**
   * 请求位置权限
   */
  requestLocationPermission: function () {
    const that = this;

    this.setData({
      loadingText: '正在请求位置权限...'
    });

    // 直接获取位置来触发权限请求
    wx.getLocation({
      type: 'gcj02',
      success: function (res) {
        console.log('getLocation success:', res);

        const location = {
          latitude: res.latitude,
          longitude: res.longitude,
          accuracy: res.accuracy
        };

        // 更新位置到全局数据
        app.globalData.location = location;
        app.globalData.hasLocationPermission = true;

        // 更新到服务器
        cloud.updateUserLocation(location)
          .then(() => {
            console.log('Location updated to server');
          })
          .catch(err => {
            console.error('Update location failed:', err);
          });

        that.setData({
          hasLocationPermission: true,
          loading: false,
          isLoggedIn: true,
          userInfo: app.globalData.userInfo
        });

        // 登录成功，自动跳转到主页
        wx.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 1500
        });

        setTimeout(() => {
          that.enterApp();
        }, 1500);
      },
      fail: function (err) {
        console.error('getLocation failed:', err);

        // 位置权限获取失败，但登录仍然成功
        app.globalData.hasLocationPermission = false;

        that.setData({
          hasLocationPermission: false,
          loading: false,
          isLoggedIn: true,
          userInfo: app.globalData.userInfo
        });

        // 提示用户位置权限的重要性，然后进入应用
        wx.showModal({
          title: '位置权限',
          content: '位置权限可以帮助您找到附近的姐妹。您可以稍后在设置中开启，现在将进入应用。',
          showCancel: false,
          confirmText: '我知道了',
          success: function () {
            that.enterApp();
          }
        });
      }
    });
  },

  /**
   * 检查位置权限
   */
  checkLocationPermission: function () {
    const that = this;

    wx.getSetting({
      success: function (res) {
        console.log('getSetting success:', res);

        const locationAuth = res.authSetting['scope.userLocation'];

        if (locationAuth === true) {
          // 已授权
          that.setData({
            hasLocationPermission: true
          });

          // 获取位置
          wx.getLocation({
            type: 'gcj02',
            success: function (locationRes) {
              const location = {
                latitude: locationRes.latitude,
                longitude: locationRes.longitude,
                accuracy: locationRes.accuracy
              };

              app.globalData.location = location;
              app.globalData.hasLocationPermission = true;

              // 更新到服务器
              cloud.updateUserLocation(location).catch(err => {
                console.error('Update location failed:', err);
              });
            }
          });
        } else if (locationAuth === false) {
          // 已拒绝授权
          that.setData({
            hasLocationPermission: false
          });
        }
        // undefined 表示未请求过权限
      }
    });
  },

  /**
   * 处理错误
   */
  handleError: function (errorMsg) {
    this.setData({
      loading: false,
      error: errorMsg || '操作失败'
    });

    wx.showToast({
      title: errorMsg || '操作失败',
      icon: 'none',
      duration: 2000
    });
  },

  /**
   * 重试登录
   */
  retry: function () {
    this.setData({
      error: '',
      loading: false
    });
    // this.onLoginTap();
  },

  /**
   * 显示用户协议
   */
  showAgreement: function () {
    wx.showModal({
      title: '用户协议',
      content: '1. 用户应遵守法律法规，不得发布违法违规信息\n2. 禁止虚假求助和恶意骚扰\n3. 平台致力于保护用户隐私和安全\n4. 详细条款请访问官网查看',
      showCancel: false
    });
  },

  /**
   * 显示隐私政策
   */
  showPrivacy: function () {
    wx.showModal({
      title: '隐私政策',
      content: '1. 我们重视您的隐私保护\n2. 位置信息已做模糊处理，保护您的隐私\n3. 我们不会向第三方泄露您的个人信息\n4. 您可以随时在设置中关闭位置权限',
      showCancel: false
    });
  }
});