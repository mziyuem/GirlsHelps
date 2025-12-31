// 云函数：情绪支持
// 基于用户输入提供情绪支持和建议

const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 验证token并获取用户ID
async function validateTokenAndGetUserId(token) {
  if (!token) {
    throw new Error('缺少访问令牌');
  }

  const parts = token.split('_');
  if (parts.length < 4 || parts[0] !== 'token') {
    throw new Error('无效的访问令牌');
  }

  const userId = `user_${parts[1]}_${parts[2]}`;

  const userQuery = await db.collection('users').where({
    userId: userId
  }).get();

  if (userQuery.data.length === 0) {
    throw new Error('用户不存在');
  }

  return userId;
}

// 情绪识别关键词
const emotionKeywords = {
  // 焦虑类
  anxiety: ['焦虑', '紧张', '担心', '不安', '压力', '慌张', '恐惧'],

  // 沮丧类
  frustration: ['沮丧', '失败', '挫折', '失望', '难过', '伤心', '失落'],

  // 孤独类
  loneliness: ['孤独', '孤单', '寂寞', '一个人', '没人陪', '空虚'],

  // 疲惫类
  fatigue: ['累', '疲惫', '疲倦', '没力气', '困倦', '精疲力尽'],

  // 迷茫类
  confusion: ['迷茫', '不知道', '不清楚', '困惑', '无助', '不知所措'],

  // 愤怒类
  anger: ['生气', '愤怒', '烦躁', '气愤', '恼火']
};

// 情绪支持内容库
const emotionSupportContent = {
  anxiety: {
    image: 'butterfly',
    role: '一只蝴蝶飞过',
    text: '"当焦虑如潮水般涌来时，请记住：你不是这场风暴，你是站在岸边的观望者。深呼吸，让每一口气都带走一些不安。"\n\n—— 给自己一点时间和空间，你值得被温柔对待。',
    suggestion: '试着做几次深呼吸，或是找一个安静的地方坐一会儿。记住，这份焦虑不会永远持续。'
  },

  frustration: {
    image: 'bird',
    role: '一只小鸟在窗台',
    text: '"失败并不可怕，可怕的是因此而停下脚步。每一片落叶，都是为了明年更茂盛的生长。你的努力，从来都没有白费。"\n\n—— 就像陶璐娜说的那样，实验失败了99次，但第100次成功了。挫折是成功路上的必经之路。',
    suggestion: '给自己一些时间消化这份情绪，然后想想：这次经历教会了我什么？下次我可以怎么做？'
  },

  loneliness: {
    image: 'star',
    role: '一颗星星在夜空',
    text: '"有时候，我们需要学会享受独处的时光。在这个快节奏的世界里，偶尔停下来和自己对话，也是一种难得的温柔。"\n\n—— 你并不孤单，有很多人和你一样，在夜晚仰望星空，想着同样的问题。',
    suggestion: '试着给老朋友打个电话，或是写下此刻的心情。分享出来，有时就能感受到温暖。'
  },

  fatigue: {
    image: 'moon',
    role: '月亮在云朵间',
    text: '"疲惫不是终点，而是提醒你该停下来休息的信号。身体和心灵，都需要适时的休憩。"\n\n—— 给自己一个拥抱，告诉自己：我已经做得够好了。',
    suggestion: '今晚早点休息，给自己准备一杯热饮，听听舒缓的音乐。明天醒来，一切都会好些。'
  },

  confusion: {
    image: 'compass',
    role: '指南针在雾中',
    text: '"迷茫时，不妨停下来，看看脚下的路。从哪里来，要到哪里去。有时候，方向不是问题，重要的是迈出的每一步。"\n\n—— 就像在雾中行走，虽然看不清远方，但脚下的路依然坚实。',
    suggestion: '试着列出让你困惑的问题，逐一分析。或者找信任的人聊聊，有时别人的视角能带来新的启发。'
  },

  anger: {
    image: 'river',
    role: '一条小河静静流',
    text: '"愤怒如洪水，会冲垮堤岸。但当你学会疏导，它也能成为灌溉田野的河流。"\n\n—— 给情绪一点时间，让它自然流过。愤怒会过去，留下的是更平静的你。',
    suggestion: '找一个安全的地方发泄情绪，比如大喊、运动，或是写下来。然后问问自己：这份愤怒的根源是什么？'
  },

  default: {
    image: 'flower',
    role: '一朵小花盛开',
    text: '"生活总是起起伏伏，但每一次经历，都让我们更坚强一些。无论遇到什么，都请记住：你值得被爱，被理解，被温柔对待。"\n\n—— 就像花朵，无论风雨，都会努力绽放。',
    suggestion: '试着深呼吸几次，感受当下的平静。记住，每个人都有脆弱的时候，这没什么不好意思的。'
  }
};

// 识别用户情绪
function identifyEmotion(message) {
  const lowerMessage = message.toLowerCase();

  for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        return emotion;
      }
    }
  }

  return 'default';
}

exports.main = async (event, context) => {
  const { token, message } = event;

  try {
    console.log('开始处理情绪支持请求');

    // 参数校验
    if (!message || message.trim().length === 0) {
      return {
        success: false,
        error: '请输入您想说的话'
      };
    }

    if (message.length > 500) {
      return {
        success: false,
        error: '输入内容过长，请控制在500字以内'
      };
    }

    // 验证token并获取用户ID
    const userId = await validateTokenAndGetUserId(token);

    // 识别情绪
    const emotion = identifyEmotion(message);
    const support = emotionSupportContent[emotion] || emotionSupportContent.default;

    console.log('情绪识别结果:', { message: message.substring(0, 50), emotion, support: support.role });

    // 记录情绪支持使用情况（可选，用于统计分析）
    try {
      await db.collection('emotion_logs').add({
        data: {
          userId: userId,
          message: message.substring(0, 200), // 只保存前200字符
          emotion: emotion,
          createTime: new Date()
        }
      });
    } catch (error) {
      // 记录失败不影响主流程
      console.error('记录情绪日志失败:', error);
    }

    return {
      success: true,
      result: {
        image: support.image,
        role: support.role,
        text: support.text,
        suggestion: support.suggestion
      },
      emotion: emotion
    };

  } catch (error) {
    console.error('情绪支持处理失败:', error);
    return {
      success: false,
      error: error.message || '处理失败，请稍后重试'
    };
  }
};
