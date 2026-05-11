// functions/index.js
// Firebase Cloud Functions v1 – MYEShim streak notifikace
// Funguje na Spark (free) plánu bez Cloud Build
// Nasazení: firebase deploy --only functions

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// ── PERSONALIZOVANÉ ZPRÁVY DLE STREAK DÉLKY ───────────────────────────────
const STREAK_MESSAGES = {
  inactive_1: [
    { title: 'Chybíš nám! 🙏', body: 'Včera jsi nestudoval. Znovu začni dnes – stále je čas!' },
    { title: 'Zjeví volá! 📜', body: 'Jeden den bez studia. Otevři si dnešní část a pokračuj!' }
  ],
  inactive_3: [
    { title: '3 dny bez studia ⚠️', body: 'Tvoje ohnivá šňůra žádá pozornost. Vrať se ke Zjevéní dnes!' },
    { title: 'Máš chůtěřku? 🔥', body: '3 dny již neotevřeno. Dneská lekce čeká na tebe!' }
  ],
  inactive_7: [
    { title: 'Týden bez studia 😔', body: 'Nezapomeň – každý den přináší nové poznání. Vrať se!' },
    { title: 'Těšíme se na tebe! 🙌', body: 'Týden uplínul. Počtej si chílku dnešní část Zjevéní.' }
  ],
  milestone_7:  { title: 'Týden v řadě! 🎉', body: '7 dní studia za sebou. Gratulujeme k tvojí vytrvalosti!' },
  milestone_30: { title: 'Měsíc studia! 👑', body: '30 dní v řadě! Neuvěřitelný výkon. Pokračuj dál!' },
  daily_verse:  { title: 'MYEShim – dnešní verze 📖', body: 'Otevři si aplikaci a přečti si dnešní část Zjevéní.' }
};

// ── HELPER: Odeslat FCM notifikaci tokenu ───────────────────────────────────────
async function sendToToken(token, msg, data = {}) {
  try {
    await admin.messaging().send({
      token,
      notification: { title: msg.title, body: msg.body },
      data: { ...data, click_action: 'https://payntrecords-gif.github.io/zjeveni-myeshim/' },
      webpush: {
        notification: {
          icon: 'https://payntrecords-gif.github.io/zjeveni-myeshim/icon-192.png',
          badge: 'https://payntrecords-gif.github.io/zjeveni-myeshim/icon-96.png'
        },
        fcmOptions: { link: 'https://payntrecords-gif.github.io/zjeveni-myeshim/' }
      }
    });
    return true;
  } catch (err) {
    if (err.code === 'messaging/registration-token-not-registered' ||
        err.code === 'messaging/invalid-registration-token') {
      functions.logger.warn('Stale token removed:', token.substring(0, 20));
      return 'stale';
    }
    functions.logger.error('sendToToken error:', err.message);
    return false;
  }
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── CRON 1: Denní verze – každý den 8:00 Europe/Prague ──────────────────────
exports.dailyVerse = functions
  .region('europe-west1')
  .pubsub.schedule('0 8 * * *')
  .timeZone('Europe/Prague')
  .onRun(async () => {
    functions.logger.info('dailyVerse: start');
    const snap = await db.collection('users').get();
    const staleRefs = [];
    let sent = 0;

    for (const doc of snap.docs) {
      const user = doc.data();
      if (!user.fcmToken || user.notifDisabled) continue;
      const result = await sendToToken(user.fcmToken, STREAK_MESSAGES.daily_verse, { type: 'daily' });
      if (result === 'stale') staleRefs.push(doc.ref);
      else if (result) sent++;
    }
    for (const ref of staleRefs) await ref.update({ fcmToken: admin.firestore.FieldValue.delete() });
    functions.logger.info(`dailyVerse done: sent=${sent}, stale=${staleRefs.length}`);
  });

// ── CRON 2: Streak inaktivita – každý den 9:00 Europe/Prague ───────────────────
exports.streakCheck = functions
  .region('europe-west1')
  .pubsub.schedule('0 9 * * *')
  .timeZone('Europe/Prague')
  .onRun(async () => {
    functions.logger.info('streakCheck: start');
    const now = Date.now();
    const DAY_MS = 86400000;
    const snap = await db.collection('users').get();
    const staleRefs = [];
    let sent = 0;

    for (const doc of snap.docs) {
      const user = doc.data();
      if (!user.fcmToken || user.notifDisabled) continue;

      const lastActive = user.lastActive ? user.lastActive.toMillis() : 0;
      const inactiveDays = Math.floor((now - lastActive) / DAY_MS);
      const streak = user.streak || 0;

      let msg = null;
      if (streak === 7)            msg = STREAK_MESSAGES.milestone_7;
      else if (streak === 30)      msg = STREAK_MESSAGES.milestone_30;
      else if (inactiveDays >= 7)  msg = pick(STREAK_MESSAGES.inactive_7);
      else if (inactiveDays >= 3)  msg = pick(STREAK_MESSAGES.inactive_3);
      else if (inactiveDays >= 1)  msg = pick(STREAK_MESSAGES.inactive_1);
      if (!msg) continue;

      const result = await sendToToken(user.fcmToken, msg, {
        type: 'streak', streak: String(streak), inactiveDays: String(inactiveDays)
      });
      if (result === 'stale') staleRefs.push(doc.ref);
      else if (result) sent++;
    }
    for (const ref of staleRefs) await ref.update({ fcmToken: admin.firestore.FieldValue.delete() });
    functions.logger.info(`streakCheck done: sent=${sent}, stale=${staleRefs.length}`);
  });
