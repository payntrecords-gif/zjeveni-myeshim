// functions/index.js - MYEShim streak notifikace v3
// Oprava: notifications je dokument v users/{uid}/data/notifications
// Proto pouzivame collectionGroup('data') a filtrujeme doc ID = 'notifications'
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const STREAK_MESSAGES = {
  inactive_1: [
    { title: 'Chybis nam!', body: 'Vcera jsi nestudoval. Znovu zacni dnes - stale je cas!' },
    { title: 'Zjeveni vola!', body: 'Jeden den bez studia. Otevri si dnesni cast a pokracuj!' }
  ],
  inactive_3: [
    { title: '3 dny bez studia', body: 'Tvoje ohniva snura potrebuje pozornost. Vrat se ke Zjeveni!' },
    { title: 'Mas chuteru?', body: '3 dny jiz neotevreno. Dneska lekce ceka na tebe!' }
  ],
  inactive_7: [
    { title: 'Tyden bez studia', body: 'Nezapomen - kazdy den prinasi nove poznani. Vrat se!' },
    { title: 'Tesime se na tebe!', body: 'Tyden uplynul. Prectis dnes dnesni cast Zjeveni?' }
  ],
  milestone_7: { title: 'Tyden v rade!', body: '7 dni studia za sebou. Gratulujeme k tvoji vytvalosti!' },
  milestone_30: { title: 'Mesic studia!', body: '30 dni v rade! Neuveritelny vykon. Pokracuj dal!' },
  daily_verse: { title: 'MYEShim - dnesni verze', body: 'Otevri si aplikaci a prectis dnesni cast Zjeveni.' }
};

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
      return 'stale';
    }
    logger.error('sendToToken error:', err.message);
    return false;
  }
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Nacte vsechny notifications dokumenty z users/{uid}/data/notifications
// Struktura: users (kolekce) -> {uid} (dokument, neexistuje) -> data (subkolekce) -> notifications (dokument)
async function getAllNotifications() {
  // collectionGroup('data') najde vsechny 'data' subkolekce a jejich dokumenty
  const dataSnap = await db.collectionGroup('data').get();
  logger.info('getAllNotifications: celkem data dokumentu=' + dataSnap.size);
  const notifs = [];
  for (const doc of dataSnap.docs) {
    if (doc.id === 'notifications') {
      notifs.push(doc);
    }
  }
  logger.info('getAllNotifications: notifications dokumentu=' + notifs.length);
  return notifs;
}

exports.dailyVerse = onSchedule(
  { schedule: '0 8 * * *', timeZone: 'Europe/Prague', region: 'europe-west1' },
  async () => {
    logger.info('dailyVerse: spoustim...');
    let notifs;
    try {
      notifs = await getAllNotifications();
    } catch (e) {
      logger.error('dailyVerse: chyba pri cteni:', e.message);
      return;
    }
    if (notifs.length === 0) {
      logger.info('dailyVerse: zadne notifications dokumenty');
      return;
    }
    const msg = STREAK_MESSAGES.daily_verse;
    let sent = 0, stale = 0, noToken = 0;
    for (const notifDoc of notifs) {
      try {
        const notif = notifDoc.data();
        logger.info('dailyVerse: path=' + notifDoc.ref.path + ', enabled=' + notif.enabled + ', hasToken=' + !!notif.fcmToken);
        if (!notif.fcmToken) { noToken++; continue; }
        if (notif.enabled === false) { noToken++; continue; }
        const result = await sendToToken(notif.fcmToken, msg, { type: 'daily_verse' });
        if (result === 'stale') {
          await notifDoc.ref.update({ fcmToken: admin.firestore.FieldValue.delete() });
          stale++;
        } else if (result) sent++;
      } catch(e) {
        logger.warn('dailyVerse error ' + notifDoc.ref.path + ':', e.message);
      }
    }
    logger.info('dailyVerse: sent=' + sent + ', stale=' + stale + ', noToken=' + noToken);
  }
);

exports.streakCheck = onSchedule(
  { schedule: '0 9 * * *', timeZone: 'Europe/Prague', region: 'europe-west1' },
  async () => {
    const now = Date.now();
    const DAY = 86400000;
    let notifs;
    try {
      notifs = await getAllNotifications();
    } catch (e) {
      logger.error('streakCheck: chyba pri cteni:', e.message);
      return;
    }
    if (notifs.length === 0) { logger.info('streakCheck: zadne notifications'); return; }
    let sent = 0;
    for (const notifDoc of notifs) {
      try {
        const notif = notifDoc.data();
        if (!notif.fcmToken || notif.enabled === false) continue;
        // streak doc je na stejne urovni: users/{uid}/data/streak
        const streakRef = notifDoc.ref.parent.doc('streak');
        const streakDoc = await streakRef.get();
        const streak = streakDoc.exists ? (streakDoc.data() || {}) : {};
        const lastDate = streak.lastDate ? new Date(streak.lastDate).getTime() : 0;
        const count = streak.count || 0;
        const inactiveDays = Math.floor((now - lastDate) / DAY);
        let msg = null;
        if (count >= 30 && inactiveDays === 0) msg = STREAK_MESSAGES.milestone_30;
        else if (count >= 7 && inactiveDays === 0) msg = STREAK_MESSAGES.milestone_7;
        else if (inactiveDays >= 7) msg = pick(STREAK_MESSAGES.inactive_7);
        else if (inactiveDays >= 3) msg = pick(STREAK_MESSAGES.inactive_3);
        else if (inactiveDays >= 1) msg = pick(STREAK_MESSAGES.inactive_1);
        if (msg) {
          const result = await sendToToken(notif.fcmToken, msg, { type: 'streak', inactiveDays: String(inactiveDays) });
          if (result === 'stale') {
            await notifDoc.ref.update({ fcmToken: admin.firestore.FieldValue.delete() });
          } else if (result) sent++;
        }
      } catch(e) {
        logger.warn('streakCheck error:', e.message);
      }
    }
    logger.info('streakCheck: sent=' + sent);
  }
);
