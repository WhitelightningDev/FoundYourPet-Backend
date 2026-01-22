const admin = require("firebase-admin");

let firebaseApp = null;
let initError = null;

function getFirebaseAdminApp() {
  if (firebaseApp) return firebaseApp;
  if (initError) return null;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    initError = new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");
    return null;
  }

  try {
    const serviceAccount = JSON.parse(raw);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return firebaseApp;
  } catch (err) {
    initError = err;
    return null;
  }
}

function canSendFcm() {
  return Boolean(getFirebaseAdminApp());
}

async function sendMulticast({ tokens, notification, data }) {
  const app = getFirebaseAdminApp();
  if (!app) return { ok: false, error: initError?.message || "FCM not configured" };

  if (!Array.isArray(tokens) || !tokens.length) return { ok: true, sent: 0, failed: 0, results: [] };

  const messaging = admin.messaging();
  const response = await messaging.sendEachForMulticast({
    tokens,
    notification,
    data,
  });

  return {
    ok: true,
    sent: response.successCount,
    failed: response.failureCount,
    responses: response.responses || [],
  };
}

module.exports = { canSendFcm, sendMulticast };

