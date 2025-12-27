// pages/map/index.js
const app = getApp();
const cloud = require('../../utils/cloud.js');

Page({
  data: {
    // 地图中心位置（初始为北京）
    longitude: 116.397428,
    latitude: 39.90923,
    // 缩放级别 5-18
    scale: 15,
    // 地图密钥（如需使用自定义样式等功能需要在腾讯地图控制台申请）
    mapKey: '',
    // 地图上下文
    mapContext: null,
    // 标记点数组
    markers: [],
    // 选中的标记
    selectedMarker: null,
    // 显示面板
    showSheet: false,
    // 用户当前位置
    userLocation: null,
    // 状态文本
    statusText: '正在定位...',
    // 隐私保护：位置偏移量（米）
    privacyOffset: 200
  },

  onLoad: function (options) {
    console.log('Map page loaded');

    // 创建地图上下文
    this.setData({
      mapContext: wx.createMapContext('tencentMap', this)
    });

    // 获取用户位置
    this.getUserLocation();
  },

  onShow: function () {
    // 页面显示时刷新位置和标记
    if (this.data.userLocation) {
      this.getUserLocation();
    }
  },

  /**
   * 获取用户位置
   */
  getUserLocation: function () {
    const that = this;

    wx.getLocation({
      type: 'gcj02', // 返回国测局坐标（腾讯地图使用gcj02）
      altitude: false,
      success: function (res) {
        console.log('Location success:', res);

        const userLocation = {
          longitude: res.longitude,
          latitude: res.latitude,
          accuracy: res.accuracy || 0
        };

        // 更新地图中心位置
        that.setData({
          longitude: res.longitude,
          latitude: res.latitude,
          userLocation: userLocation,
          statusText: '当前位置（模糊显示）'
        });

        // 更新位置到服务器
        cloud.updateUserLocation(userLocation)
          .then(() => {
            console.log('Location updated to server');
          })
          .catch(err => {
            console.error('Update location failed:', err);
          });

        // 从服务器获取附近用户并生成标记点
        that.generateMarkers();

        // 移动地图到用户位置
        that.moveToLocation();
      },
      fail: function (err) {
        console.error('Location failed:', err);

        // 定位失败，显示权限请求
        if (err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '位置权限',
            content: '需要获取您的位置信息来显示附近的姐妹。请在设置中开启位置权限。',
            confirmText: '去设置',
            success: function (res) {
              if (res.confirm) {
                wx.openSetting();
              }
            }
          });
          that.setData({
            statusText: '定位失败，请开启位置权限'
          });
        } else {
          that.setData({
            statusText: '定位中...'
          });
        }

        // 失败时使用默认标记点
        that.generateDefaultMarkers();
      }
    });
  },

  /**
   * 生成标记点（从服务器获取附近用户）
   */
  generateMarkers: function () {
    const that = this;
    const { userLocation } = this.data;

    if (!userLocation) {
      // 如果没有用户位置，生成默认标记点
      this.generateDefaultMarkers();
      return;
    }

    // 显示加载提示
    wx.showLoading({
      title: '加载附近姐妹...',
      mask: true
    });

    // 调用云函数获取附近用户
    cloud.getNearbyUsers(userLocation, 2000, 20)
      .then(res => {
        console.log('Nearby users:', res);

        const markers = [];

        // 将服务器返回的用户转换为标记点
        res.users.forEach((user, index) => {
          markers.push({
            id: index + 1,
            longitude: user.location.longitude,
            latitude: user.location.latitude,
            type: user.type,
            distance: user.distance,
            provide: user.provide || '',
            need: user.need || '',
            userId: user.userId,
            nickName: user.nickName,
            width: 32,
            height: 32,
            iconPath: user.type === 'helper'
              ? '/images/marker-helper.png'
              : '/images/marker-seeker.png',
            alpha: 0.9,
            customCallout: {
              anchorY: 0,
              anchorX: 0,
              display: 'BYCLICK',
              textAlign: 'center',
              bgColor: user.type === 'helper' ? '#FFA4A4' : '#BADFDB',
              color: '#333',
              fontSize: 12,
              borderRadius: 8,
              padding: 8,
              content: user.type === 'helper' ? '🤝' : '🆘'
            }
          });
        });

        // 添加用户当前位置标记（中心点）
        markers.push({
          id: 0,
          longitude: userLocation.longitude,
          latitude: userLocation.latitude,
          type: 'user',
          width: 24,
          height: 24,
          iconPath: '/images/marker-user.png',
          alpha: 1,
          zIndex: 100
        });

        that.setData({ markers });

        if (res.users.length === 0) {
          that.setData({
            statusText: '附近暂无其他姐妹'
          });
        } else {
          that.setData({
            statusText: `附近找到 ${res.users.length} 位姐妹`
          });
        }

        wx.hideLoading();
      })
      .catch(err => {
        console.error('Get nearby users failed:', err);

        wx.hideLoading();

        // 失败时使用默认标记点
        that.generateDefaultMarkers();

        that.setData({
          statusText: '加载失败，请稍后重试'
        });
      });
  },

  /**
   * 生成默认标记点（当没有用户位置或获取失败时）
   */
  generateDefaultMarkers: function () {
    const markers = [];
    const baseLng = this.data.longitude;
    const baseLat = this.data.latitude;

    for (let i = 0; i < 8; i++) {
      const type = Math.random() > 0.5 ? 'helper' : 'seeker';
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * 500 + 200;

      const deltaLng = (Math.cos(angle) * distance) / 111000;
      const deltaLat = (Math.sin(angle) * distance) / 111000;

      markers.push({
        id: i + 1,
        longitude: baseLng + deltaLng,
        latitude: baseLat + deltaLat,
        type: type,
        distance: Math.floor(distance),
        provide: '卫生巾',
        need: '卫生巾',
        width: 32,
        height: 32,
        iconPath: type === 'helper'
          ? '/images/marker-helper.png'
          : '/images/marker-seeker.png',
        alpha: 0.9,
        customCallout: {
          anchorY: 0,
          anchorX: 0,
          display: 'BYCLICK',
          textAlign: 'center',
          bgColor: type === 'helper' ? '#FFA4A4' : '#BADFDB',
          color: '#333',
          fontSize: 12,
          borderRadius: 8,
          padding: 8,
          content: type === 'helper' ? '🤝' : '🆘'
        }
      });
    }

    // 添加用户当前位置标记
    markers.push({
      id: 0,
      longitude: baseLng,
      latitude: baseLat,
      type: 'user',
      width: 24,
      height: 24,
      iconPath: '/images/marker-user.png',
      alpha: 1,
      zIndex: 100
    });

    this.setData({ markers });
  },

  /**
   * 标记点点击事件
   */
  onMarkerTap: function (e) {
    const markerId = e.detail.markerId;
    console.log('Marker tapped:', markerId);

    // 忽略用户自己的标记
    if (markerId === 0) {
      return;
    }

    const marker = this.data.markers.find(m => m.id === markerId);
    if (marker) {
      this.setData({
        selectedMarker: marker,
        showSheet: true
      });

      // 移动地图到标记位置
      if (this.data.mapContext) {
        this.data.mapContext.moveToLocation({
          longitude: marker.longitude,
          latitude: marker.latitude,
          scale: 16
        });
      }
    }
  },

  /**
   * 地图区域变化事件
   */
  onRegionChange: function (e) {
    if (e.type === 'end') {
      console.log('Map region changed:', e.detail);
    }
  },

  /**
   * 地图点击事件
   */
  onMapTap: function (e) {
    console.log('Map tapped:', e);
    // 点击地图空白处，关闭底部面板
    if (this.data.showSheet) {
      this.closeBottomSheet();
    }
  },

  /**
   * 关闭底部面板
   */
  closeBottomSheet: function () {
    this.setData({
      showSheet: false,
      selectedMarker: null
    });
  },

  /**
   * 移动到用户位置
   */
  moveToLocation: function () {
    const that = this;

    if (this.data.userLocation) {
      if (this.data.mapContext) {
        this.data.mapContext.moveToLocation({
          longitude: this.data.userLocation.longitude,
          latitude: this.data.userLocation.latitude,
          scale: 15
        });
      }
      this.setData({
        longitude: this.data.userLocation.longitude,
        latitude: this.data.userLocation.latitude,
        scale: 15
      });
    } else {
      // 重新获取位置
      this.getUserLocation();
    }
  },

  /**
   * 放大地图
   */
  zoomIn: function () {
    let scale = this.data.scale + 1;
    if (scale > 18) scale = 18;
    this.setData({ scale });
  },

  /**
   * 缩小地图
   */
  zoomOut: function () {
    let scale = this.data.scale - 1;
    if (scale < 5) scale = 5;
    this.setData({ scale });
  },

  /**
   * 联系按钮点击
   */
  contactPerson: function () {
    const that = this;
    const { selectedMarker } = this.data;

    if (!selectedMarker) {
      return;
    }

    const contactType = selectedMarker.type === 'helper' ? 'help_request' : 'help_offer';

    // 调用云函数联系用户
    cloud.contactUser(selectedMarker.userId, contactType)
      .then(res => {
        console.log('Contact sent:', res);

        wx.showToast({
          title: res.message || '已发送通知',
          icon: 'success',
          duration: 2000
        });

        that.closeBottomSheet();
      })
      .catch(err => {
        console.error('Contact failed:', err);

        wx.showToast({
          title: err.error || '联系失败',
          icon: 'none',
          duration: 2000
        });
      });
  },

  /**
   * 导航功能
   */
  navigateTo: function () {
    const { selectedMarker, userLocation } = this.data;

    if (selectedMarker && userLocation) {
      wx.openLocation({
        latitude: selectedMarker.latitude,
        longitude: selectedMarker.longitude,
        scale: 18,
        name: selectedMarker.type === 'helper' ? '帮助者位置' : '求助者位置',
        address: `距离约${selectedMarker.distance}米`
      });
    } else {
      wx.showToast({
        title: '无法导航',
        icon: 'none'
      });
    }
  }
});
