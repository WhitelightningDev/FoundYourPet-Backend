const webpush = require("web-push");

let initialized = false;
let initError = null;

function initWebPush() {
  if (initialized) return;
  initialized = true;

  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_CONTACT || "mailto:support@foundyourpet.co.za";

  if (!publicKey || !privateKey) {
    initError = new Error("Missing WEB_PUSH_VAPID_PUBLIC_KEY/WEB_PUSH_VAPID_PRIVATE_KEY");
    return;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch (err) {
    initError = err;
  }
}

function canSendWebPush() {
  initWebPush();
  return !initError;
}

function getWebPushInitError() {
  initWebPush();
  return initError;
}

function getVapidPublicKey() {
  return process.env.WEB_PUSH_VAPID_PUBLIC_KEY || null;
}

async function sendNotification(subscription, payload) {
  initWebPush();
  if (initError) return { ok: false, error: initError.message };

  try {
    await webpush.sendNotification(subscription, payload);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      statusCode: err?.statusCode,
      error: err?.body || err?.message || "Failed to send",
    };
  }
}

module.exports = { canSendWebPush, getWebPushInitError, getVapidPublicKey, sendNotification };
