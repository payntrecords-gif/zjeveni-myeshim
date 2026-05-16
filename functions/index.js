const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const APP_URL = 'https://payntrecords-gif.github.io/zjeveni-myeshim/';
const DAILY_REMINDER_TAG = 'daily-reminder';
const DAY_MS = 86400000;

const REVELATION_CHAPTER_VERSE_COUNTS = [20, 29, 22, 11, 14, 17, 17, 13, 21, 11, 19, 17, 18, 20, 8, 21, 18, 24, 21, 15, 27, 21];
const DAILY_START_YMD = '2026-05-11';
const DAILY_START_INDEX = 158; // Zj 9:16 v interním pořadí veršů
const TOTAL_REVELATION_VERSES = REVELATION_CHAPTER_VERSE_COUNTS.reduce((sum, count) => sum + count, 0);

function getPragueYmd(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function ymdToUtcMs(ymd) {
  return Date.parse(`${ymd}T00:00:00Z`);
}

function verseIndexToRef(index) {
  let remaining = index;
  for (let chapter = 0; chapter < REVELATION_CHAPTER_VERSE_COUNTS.length; chapter++) {
    const count = REVELATION_CHAPTER_VERSE_COUNTS[chapter];
    if (remaining < count) return `${chapter + 1}:${remaining + 1}`;
    remaining -= count;
  }
  return '1:1';
}

function getDailyVerseRef(todayYmd) {
  const daysSinceStart = Math.max(0, Math.floor((ymdToUtcMs(todayYmd) - ymdToUtcMs(DAILY_START_YMD)) / DAY_MS));
  const index = (DAILY_START_INDEX + daysSinceStart) % TOTAL_REVELATION_VERSES;
  return verseIndexToRef(index);
}

function pickReminderMessage(todayYmd) {
  const verseRef = getDailyVerseRef(todayYmd);
  return {
    title: 'Nezapomeň na dnešní verš 📖',
    body: verseRef ? `Dnešní čtení: Zj ${verseRef}. Otevři iginjaSlovo a pokračuj ve studiu.` : 'Otevři iginjaSlovo a pokračuj ve dnešním čtení.',
    ref: verseRef
  };
}

async function sendReminderToToken(token, message) {
  try {
    await admin.messaging().send({
      token,
      notification: {
        title: message.title,
        body: message.body
      },
      data: {
        type: 'daily_reminder',
        title: message.title,
        body: message.body,
        ref: message.ref || '',
        source: DAILY_REMINDER_TAG,
        url: APP_URL,
        tag: DAILY_REMINDER_TAG
      },
      webpush: {
        notification: {
          title: message.title,
          body: message.body,
          icon: `${APP_URL}icon-192.png`,
          badge: `${APP_URL}icon-96.png`,
          tag: DAILY_REMINDER_TAG,
          renotify: false
        },
        fcmOptions: { link: APP_URL }
      }
    });
    return true;
  } catch (err) {
    if (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token') {
      return 'stale';
    }
    logger.error('sendReminderToToken error:', err.message);
    return false;
  }
}

async function getAllNotificationDocs() {
  const usersSnap = await db.collection('users').get();
  const promises = usersSnap.docs.map(userDoc =>
    userDoc.ref.collection('data').doc('notifications').get()
  );
  const notifDocs = await Promise.all(promises);
  return notifDocs.filter(doc => doc.exists);
}

function isValidYmd(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function getLastOpenDateForNotifDoc(notifDoc) {
  const userDocRef = notifDoc.ref.parent.parent;
  if (!userDocRef) return '';

  let lastOpenDate = '';
  const userDoc = await userDocRef.get();
  if (userDoc.exists) {
    const userData = userDoc.data() || {};
    if (isValidYmd(userData.lastOpenDate)) lastOpenDate = userData.lastOpenDate;
  }

  if (lastOpenDate) return lastOpenDate;

  const streakDoc = await notifDoc.ref.parent.doc('streak').get();
  if (!streakDoc.exists) return '';
  const streakData = streakDoc.data() || {};
  return isValidYmd(streakData.lastDate) ? streakData.lastDate : '';
}

exports.dailyReminder = onSchedule(
  { schedule: '0 8 * * *', timeZone: 'Europe/Prague', region: 'europe-west1', timeoutSeconds: 540 },
  async () => {
    const todayYmd = getPragueYmd();
    const reminderMessage = pickReminderMessage(todayYmd);
    logger.info(`dailyReminder: start for ${todayYmd}, ref=${reminderMessage.ref || 'n/a'}`);

    let notifDocs = [];
    try {
      notifDocs = await getAllNotificationDocs();
    } catch (error) {
      logger.error('dailyReminder: failed to load notifications docs:', error.message);
      return;
    }

    let sent = 0;
    let skippedOpenedToday = 0;
    let skippedNoToken = 0;
    let stale = 0;

    const BATCH_SIZE = 50;
    for (let i = 0; i < notifDocs.length; i += BATCH_SIZE) {
      const batch = notifDocs.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async (notifDoc) => {
        try {
          const notif = notifDoc.data() || {};
          if (!notif.fcmToken || notif.enabled === false) {
            return { type: 'skippedNoToken' };
          }

          const lastOpenDate = await getLastOpenDateForNotifDoc(notifDoc);
          if (lastOpenDate === todayYmd) {
            return { type: 'skippedOpenedToday' };
          }

          const result = await sendReminderToToken(notif.fcmToken, reminderMessage);
          if (result === 'stale') {
            await notifDoc.ref.update({ fcmToken: admin.firestore.FieldValue.delete() });
            return { type: 'stale' };
          } else if (result) {
            return { type: 'sent' };
          }
          return { type: 'failed' };
        } catch (error) {
          logger.warn(`dailyReminder: failed for ${notifDoc.ref.path}:`, error.message);
          return { type: 'failed' };
        }
      }));

      for (const r of results) {
        if (r.type === 'sent') sent++;
        else if (r.type === 'skippedOpenedToday') skippedOpenedToday++;
        else if (r.type === 'skippedNoToken') skippedNoToken++;
        else if (r.type === 'stale') stale++;
      }
    }

    logger.info(`dailyReminder: sent=${sent}, skippedOpenedToday=${skippedOpenedToday}, skippedNoToken=${skippedNoToken}, stale=${stale}`);
  }
);
