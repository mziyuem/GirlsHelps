// pages/map/index.js
Page({
  data: {
    points: [],
    selectedPoint: null,
    userLocation: { x: 50, y: 50 } // 模拟用户位置
  },

  onLoad: function (options) {
    console.log('Map page loaded');
    this.generatePoints();
  },

  // 生成随机点
  generatePoints: function () {
    const points = [];
    for (let i = 0; i < 15; i++) {
      // 随机角度和半径
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 150 + 20;

      points.push({
        id: i,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        type: Math.random() > 0.7 ? 'seeker' : 'helper',
        distance: Math.floor(radius * 2) // 模拟距离
      });
    }
    this.setData({ points });
  },

  // 选择点
  selectPoint: function (e) {
    const pointId = e.currentTarget.dataset.id;
    const selectedPoint = this.data.points.find(p => p.id === pointId);
    this.setData({ selectedPoint });
  },

  // 关闭底部面板
  closeBottomSheet: function () {
    this.setData({ selectedPoint: null });
  },

  // 联系按钮点击
  contactPerson: function () {
    const { selectedPoint } = this.data;
    if (selectedPoint) {
      wx.showToast({
        title: selectedPoint.type === 'helper' ? '正在联系...' : '正在发送帮助信息...',
        icon: 'loading',
        duration: 2000
      });
    }
  }
});