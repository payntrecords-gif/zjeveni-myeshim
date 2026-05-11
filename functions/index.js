// functions/index.js
// Firebase Cloud Functions v2 – MYEShim streak notifikace
// Nasazeni: firebase deploy --only functions

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// — PERSONALIZOVANE ZPRAVY DLE STREAK DELKY ——————————————————————
const STREAK_MESSAGES = {
  inactive_1: [
    { title: 'Chybis nam!', body: 'Vcera jsi nestudoval. Znovu zacni dnes – stale je cas!' },
    { title: 'Zjeveni vola!', body: 'Jeden den bez studia. Otevri si dnesni cast a pokracuj!' }
  ],
  inactive_3: [
    { title: '3 dny bez studia', body: 'Tvoje ohniva snura zada pozornost. Vrat se ke Zjeveni dnes!' },
    { title: 'Mas chuteru?', body: '3 dny jiz neotevreno. Dneska lekce ceka na tebe!' }
  ],
  inactive_7: [
    { title: 'Tyden bez studia', body: 'Nezapomen – kazdy den prinasi nove poznani. Vrat se!' },
    { title: 'Tesime se na tebe!', body: 'Tyden uplynul. Pocitej si chilku dnesni cast Zjeveni.' }
  ],
  milestone_7: { title: 'Tyden v rade!', body: '7 dni studia za sebou. Gratulujeme k tvoji vytvalosti!' },
  milestone_30: { title: 'Mesic studia!', body: '30 dni v rade! Neuveritelny vykon. Pokracuj dal!' },
  daily_verse: { title: 'MYEShim – dnesni verze', body: 'Otevri si aplikaci a prectis dnesni cast Zjeveni.' }
};

// — HELPER: Odeslat FCM notifikaci tokenu ————————————————————————
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
      logger.warn('Stale token removed:', token.substring(0, 20));
      return 'stale';
    }
    logger.error('sendToToken error:', err.message);
    return false;
  }
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// — CRON 1: Denni verze (kazdy den v 8:00 Praha) ————————————————
exports.dailyVerse = onSchedule(
  { schedule: '0 8 * * *', timeZone: 'Europe/Prague', region: 'europe-west1' },
  async () => {
    const snapshot = await db.collection('fcmTokens').get();
    if (snapshot.empty) { logger.info('dailyVerse: zadne tokeny'); return; }
    const msg = STREAK_MESSAGES.daily_verse;
    let sent = 0, stale = 0;
    for (const doc of snapshot.docs) {
      const token = doc.id;
      const result = await sendToToken(token, msg, { type: 'daily_verse' });
      if (result === 'stale') { await doc.ref.delete(); stale++; }
      else if (result) sent++;
    }
    logger.info(`dailyVerse: sent=${sent}, stale=${stale}`);
  }
);

// — CRON 2: Streak inaktivita (kazdy den v 9:00 Praha) ——————————
exports.streakCheck = onSchedule(
  { schedule: '0 9 * * *', timeZone: 'Europe/Prague', region: 'europe-west1' },
  async () => {
    const now = Date.now();
    const DAY = 86400000;
    const snapshot = await db.collection('users').get();
    if (snapshot.empty) { logger.info('streakCheck: zadni uzivatele'); return; }
    let sent = 0;
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const lastStudy = data.lastStudyDate ? new Date(data.lastStudyDate).getTime() : 0;
      const streak = data.streak || 0;
      const inactiveDays = Math.floor((now - lastStudy) / DAY);
      const fcmToken = data.fcmToken;
      if (!fcmToken) continue;
      let msg = null;
      if (streak >= 30 && inactiveDays === 0) msg = STREAK_MESSAGES.milestone_30;
      else if (streak >= 7 && inactiveDays === 0) msg = STREAK_MESSAGES.milestone_7;
      else if (inactiveDays >= 7) msg = pick(STREAK_MESSAGES.inactive_7);
      else if (inactiveDays >= 3) msg = pick(STREAK_MESSAGES.inactive_3);
      else if (inactiveDays >= 1) msg = pick(STREAK_MESSAGES.inactive_1);
      if (msg) {
        const result = await sendToToken(fcmToken, msg, { type: 'streak', inactiveDays: String(inactiveDays) });
        if (result === 'stale') {
          await doc.ref.update({ fcmToken: admin.firestore.FieldValue.delete() });
        } else if (result) sent++;
      }
    }
    logger.info(`streakCheck: sent=${sent}`);
  }
);
