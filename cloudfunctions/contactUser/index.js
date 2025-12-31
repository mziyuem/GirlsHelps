// cloudfunctions/contactUser/index.js
// Contact user and create help session cloud function

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * Generate session ID
 */
function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { token, targetUserId, type, resource, requestId } = event;

  console.log('[ContactUser] Request:', {
    openid: wxContext.OPENID,
    targetUserId: targetUserId,
    type: type,
    resource: resource,
    requestId: requestId
  });

  try {
    // Get current user info
    const currentUserResult = await db.collection('users').where({
      openid: wxContext.OPENID
    }).get();

    if (currentUserResult.data.length === 0) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    const currentUser = currentUserResult.data[0];

    // Get target user info
    const targetUserResult = await db.collection('users').where({
      userId: targetUserId
    }).get();

    if (targetUserResult.data.length === 0) {
      return {
        success: false,
        error: 'Target user not found'
      };
    }

    const targetUser = targetUserResult.data[0];

    // Handle different contact types
    if (type === 'resource_request') {
      // Resource request: create a help request first, then create session
      const helpRequestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const now = new Date();

      // Create help request
      const requestData = {
        openid: wxContext.OPENID,
        userId: currentUser.userId,
        requestId: helpRequestId,
        type: 'other',
        note: `Requesting resource: ${resource}`,
        status: 'matched',
        location: currentUser.currentLocation || {
          latitude: 0,
          longitude: 0,
          accuracy: 0
        },
        matchedUsers: [targetUser.userId],
        activeHelperId: targetUser.userId,
        createTime: now,
        matchTime: now,
        completeTime: null,
        expireTime: new Date(now.getTime() + 30 * 60 * 1000),
        cancelTime: null
      };

      await db.collection('help_requests').add({
        data: requestData
      });

      // Create session
      const sessionId = generateSessionId();
      const sessionData = {
        sessionId: sessionId,
        requestId: helpRequestId,
        seekerId: currentUser.userId,
        helperId: targetUser.userId,
        status: 'active',
        resource: resource,
        meetingPoint: null,
        meetingTime: null,
        messages: [],
        createTime: now,
        completeTime: null
      };

      await db.collection('help_sessions').add({
        data: sessionData
      });

      console.log('[ContactUser] Resource request session created:', sessionId);

      return {
        success: true,
        sessionId: sessionId,
        requestId: helpRequestId,
        message: 'Resource request sent'
      };
    }

    // Original logic for help_request type
    let requestInfo = null;
    if (requestId) {
      const requestResult = await db.collection('help_requests').where({
        requestId: requestId
      }).get();

      if (requestResult.data.length > 0) {
        requestInfo = requestResult.data[0];
      }
    }

    // Create help session
    const sessionId = generateSessionId();
    const now = new Date();

    const sessionData = {
      sessionId: sessionId,
      requestId: requestId || null,
      seekerId: currentUser.userId,
      helperId: targetUser.userId,
      status: 'active',
      meetingPoint: null,
      meetingTime: null,
      messages: [],
      createTime: now,
      completeTime: null
    };

    const sessionResult = await db.collection('help_sessions').add({
      data: sessionData
    });

    // Update associated help request status
    if (requestId && requestInfo) {
      await db.collection('help_requests').where({
        requestId: requestId
      }).update({
        data: {
          status: 'active',
          activeHelperId: targetUser.userId,
          matchedUsers: [targetUser.userId]
        }
      });
    }

    console.log('[ContactUser] Session created:', sessionId);

    return {
      success: true,
      sessionId: sessionId,
      message: 'Session created successfully'
    };

  } catch (err) {
    console.error('[ContactUser] Error:', err);
    return {
      success: false,
      error: err.message || 'Failed to create session'
    };
  }
};
