// functions/index.js
// Firebase Cloud Functions – MYEShim streak notifikace
// Nasazení: firebase deploy --only functions

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// ── PERSONALIZOVANÉ ZPRÁVY DLE STREAK DÉLKY ──────────────────────────────────
const STREAK_MESSAGES = {
  inactive_1: [
    { title: 'Chybíš nám! 🙏', body: 'Včera jsi nestudoval. Znovu začni dnes – stále je čas!' },
    { title: 'Zjeví kčí 📜', body: 'Jeden den bez studia. Otevři si dnešní verze a pokračuj!' }
  ],
  inactive_3: [
    { title: '3 dny bez studia ⚠️', body: 'Tvoje ohnivá šňůra žádá pozornost. Vrať se ke Zjevéní dnes!' },
    { title: 'Máš chųtěřku? 🔥', body: '3 dny již neotevřeno. Dneská lekce čeká na tebe!' }
  ],
  inactive_7: [
    { title: 'Týden bez studia 😔', body: 'Nezapomeň – každý den přináší nové poznání. Vrať se!' },
    { title: 'Těšíme se na tebe! 🙌', body: 'Týden uplínul. Počtej si chĩlku dnešní část Zjevéní.' }
  ],
  milestone_7:  { title: 'Týden v řadě! 🎉', body: '7 dní studia za sebou. Gratulujeme k tvojí vytrvalosti!' },
  milestone_30: { title: 'Měsíc studia! 👑', body: '30 dní v řadě! Neuvěřitelný výkon. Pokračuj dál!' },
  daily_verse:  { title: 'MYEShim – dnešní verze 📖', body: 'Otevři si aplikaci a přečti si dnešní část Zjevéní.' }
};

// ── HELPER: Odeslat FCM notifikaci konkrétnímu tokenu ───────────────────────
async function sendToToken(token, msg, data = {}) {
  try {
    await admin.messaging().send({
      token,
      notification: { title: msg.title, body: msg.body },
      data: { ...data, click_action: 'https://payntrecords-gif.github.io/zjeveni-myeshim/' },
      webpush: {
        notification: {
          icon: 'https://payntrecords-gif.github.io/zjeveni-myeshim/icon-192.png',
          badge: 'https://payntrecords-gif.github.io/zjeveni-myeshim/icon-96.png',
          requireInteraction: false
        },
        fcmOptions: { link: 'https://payntrecords-gif.github.io/zjeveni-myeshim/' }
      }
    });
    return true;
  } catch (err) {
    // Token je neplatný – smaž ho z Firestore
    if (err.code === 'messaging/registration-token-not-registered' ||
        err.code === 'messaging/invalid-registration-token') {
      logger.warn('Removing stale token:', token.substring(0, 20) + '...');
      return 'stale';
    }
    logger.error('sendToToken error:', err.message);
    return false;
  }
}

// ── HELPER: Náhodný prvek z pole ──────────────────────────────────────────────
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── CRON 1: Denní verze – každý den v 8:00 (Prague) ─────────────────────────
// Posílá push všem uživatelům, kteří mají platný token a zapnuté notifikace
exports.dailyVerse = onSchedule(
  { schedule: '0 8 * * *', timeZone: 'Europe/Prague', region: 'europe-west1' },
  async () => {
    logger.info('dailyVerse: start');
    const snap = await db.collection('users').get();
    const staleTokens = [];
    let sent = 0;

    for (const doc of snap.docs) {
      const user = doc.data();
      if (!user.fcmToken || user.notifDisabled) continue;

      const result = await sendToToken(user.fcmToken, STREAK_MESSAGES.daily_verse, { type: 'daily' });
      if (result === 'stale') {
        staleTokens.push(doc.ref);
      } else if (result) {
        sent++;
      }
    }

    // Smaž nefunkční tokeny
    for (const ref of staleTokens) {
      await ref.update({ fcmToken: admin.firestore.FieldValue.delete() });
    }

    logger.info(`dailyVerse: sent=${sent}, stale=${staleTokens.length}`);
  }
);

// ── CRON 2: Streak kontrola inaktivity – každý den v 9:00 (Prague) ───────────
// Zkontroluje poslední aktivitu každého uživatele a pošle personalizovanou zprávu
exports.streakCheck = onSchedule(
  { schedule: '0 9 * * *', timeZone: 'Europe/Prague', region: 'europe-west1' },
  async () => {
    logger.info('streakCheck: start');
    const now = Date.now();
    const DAY_MS = 86400000;
    const snap = await db.collection('users').get();
    const staleTokens = [];
    let sent = 0;

    for (const doc of snap.docs) {
      const user = doc.data();
      if (!user.fcmToken || user.notifDisabled) continue;

      const lastActive = user.lastActive ? user.lastActive.toMillis() : 0;
      const inactiveDays = Math.floor((now - lastActive) / DAY_MS);
      const streak = user.streak || 0;

      let msg = null;

      // Milestone notifikace (jednou – nekontrolujeme duplicity pro jednoduchost)
      if (streak === 7) {
        msg = STREAK_MESSAGES.milestone_7;
      } else if (streak === 30) {
        msg = STREAK_MESSAGES.milestone_30;
      }
      // Inaktivita notifikace
      else if (inactiveDays >= 7) {
        msg = pick(STREAK_MESSAGES.inactive_7);
      } else if (inactiveDays >= 3) {
        msg = pick(STREAK_MESSAGES.inactive_3);
      } else if (inactiveDays >= 1) {
        msg = pick(STREAK_MESSAGES.inactive_1);
      }

      if (!msg) continue;

      const result = await sendToToken(user.fcmToken, msg, {
        type: 'streak',
        streak: String(streak),
        inactiveDays: String(inactiveDays)
      });

      if (result === 'stale') {
        staleTokens.push(doc.ref);
      } else if (result) {
        sent++;
      }
    }

    for (const ref of staleTokens) {
      await ref.update({ fcmToken: admin.firestore.FieldValue.delete() });
    }

    logger.info(`streakCheck: sent=${sent}, stale=${staleTokens.length}`);
  }
);
