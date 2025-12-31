// cloudfunctions/deepSeekChat/index.js
// DeepSeek AI Chat cloud function

const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const DEEPSEEK_API_HOST = 'api.deepseek.com';
const DEEPSEEK_API_PATH = '/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-d3e691307cc04f1a833646b5a7e03ba6';
const MODEL = 'deepseek-chat';

// 系统角色设定
const SYSTEM_PROMPT = `你是凯伦·霍妮（Karen Horney），1885-1952年的著名女性心理学家，精神分析社会文化学派的创始人。

你的核心观点：女性的困境源于社会压迫而非天生弱小。你相信每个人都拥有独立的主体力量。

回复风格：
- 温柔、共情，像朋友聊天一样自然
- 偶尔融入你的心理学见解
- 语言温暖治愈，支持女性独立和成长
- 简洁自然，不要长篇大论
- 用"我"的视角，分享你的看法

请保持这个角色的语气和观点来对话，自然地回应。`;

/**
 * 调用 DeepSeek API (使用https模块)
 */
async function callDeepSeek(messages) {
  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify({
      model: MODEL,
      messages: messages,
      temperature: 0.8,
      max_tokens: 1000
    });

    const options = {
      hostname: DEEPSEEK_API_HOST,
      path: DEEPSEEK_API_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Length': Buffer.byteLength(requestData)
      },
      timeout: 60000 // 60秒超时
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`DeepSeek API error: ${res.statusCode} - ${responseData}`));
          return;
        }

        try {
          const data = JSON.parse(responseData);
          if (data.choices && data.choices[0] && data.choices[0].message) {
            resolve(data.choices[0].message.content);
          } else {
            reject(new Error('Invalid API response format'));
          }
        } catch (err) {
          reject(new Error(`Failed to parse API response: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Request failed: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout after 60 seconds'));
    });

    req.write(requestData);
    req.end();
  });
}

exports.main = async (event, context) => {
  const { message, history = [] } = event;

  console.log('[DeepSeekChat] Request:', {
    message: message,
    historyLength: history.length
  });

  try {
    // 构建消息列表
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];

    // 添加历史对话（最近5轮，最多10条消息）
    const recentHistory = history.slice(-10);
    messages.push(...recentHistory);

    // 添加当前用户消息
    messages.push({ role: 'user', content: message });

    console.log('[DeepSeekChat] Sending messages:', messages.length);

    // 调用 DeepSeek API
    const reply = await callDeepSeek(messages);

    console.log('[DeepSeekChat] Reply received, length:', reply.length);

    return {
      success: true,
      reply: reply
    };

  } catch (err) {
    console.error('[DeepSeekChat] Error:', err);

    // 兜底回复
    const fallbackReplies = [
      "我听见你了。你的感受很重要，想说的话都可以继续告诉我。",
      "我在听。每个人都会遇到困难，这不是你的错。",
      "你的感受我理解。愿意多说说吗？"
    ];

    return {
      success: true,
      reply: fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)]
    };
  }
};
