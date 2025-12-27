// cloudfunctions/emotionSupport/index.js
// 情绪支持云函数

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 简单的情绪分析
 * 返回对应的支持内容
 */
function analyzeEmotion(message) {
  const text = message.toLowerCase();

  // 累、难过相关的关键词
  if (text.includes('累') || text.includes('难过') || text.includes('伤心') || text.includes('痛苦') || text.includes('委屈')) {
    return {
      image: 'flower',
      role: '墙角的小白花',
      text: '"在这喧嚣的世界里，允许自己安静地枯萎一会儿，也是一种生命力。即使此刻感到疲惫，阳光依然会照进来。"'
    };
  }

  // 生气、烦相关的关键词
  if (text.includes('生气') || text.includes('烦') || text.includes('愤怒') || text.includes('火大') || text.includes('讨厌')) {
    return {
      image: 'rain',
      role: '夏日的雷阵雨',
      text: '"宣泄是自然的韵律，大雨过后，空气会变得格外清新。你的情绪是真实的，也是值得被看见的。"'
    };
  }

  // 焦虑、担心相关的关键词
  if (text.includes('焦虑') || text.includes('担心') || text.includes('害怕') || text.includes('紧张') || text.includes('不安')) {
    return {
      image: 'moon',
      role: '温柔的月光',
      text: '"夜色再深，星星依然在闪烁。你不必独自承担所有，像月光一样，温柔地对待自己吧。"'
    };
  }

  // 孤独相关的关键词
  if (text.includes('孤独') || text.includes('孤单') || text.includes('一个人') || text.includes('寂寞')) {
    return {
      image: 'tree',
      role: '一棵安静的树',
      text: '"独处时，树依然扎根大地，向着天空生长。你并不孤单，我们都在这里陪伴着你。"'
    };
  }

  // 默认回应
  const defaults = [
    {
      image: 'bird',
      role: '一只路过的小鸟',
      text: '"每一次跌倒，都是为了学会飞翔。" \n—— 即使翅膀受损，天空依然为你敞开。'
    },
    {
      image: 'cloud',
      role: '漂浮的白云',
      text: '"云朵有时会被风吹散，但它们总会重新聚在一起。" \n—— 困难也会过去，美好会再来。'
    },
    {
      image: 'sun',
      role: '清晨的阳光',
      text: '"无论昨夜多么黑暗，太阳总会照常升起。" \n—— 新的一天，新的可能。'
    }
  ];

  return defaults[Math.floor(Math.random() * defaults.length)];
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { token, message } = event;

  console.log('[EmotionSupport] Request:', {
    openid: wxContext.OPENID,
    message: message
  });

  try {
    // 分析情绪并生成回应
    const result = analyzeEmotion(message);

    // 记录到数据库（可选，用于后续分析）
    await db.collection('emotion_supports').add({
      data: {
        _openid: wxContext.OPENID,
        input: message,
        result: result,
        createTime: new Date()
      }
    });

    console.log('[EmotionSupport] Result:', result);

    return {
      success: true,
      result: result
    };

  } catch (err) {
    console.error('[EmotionSupport] Error:', err);

    // 即使出错，也返回一个默认的回应
    return {
      success: true,
      result: {
        image: 'bird',
        role: '一只路过的小鸟',
        text: '"每一次倾诉，都是一次释放。" \n—— 谢谢你愿意分享。'
      }
    };
  }
};
