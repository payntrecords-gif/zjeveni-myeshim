importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDNxmsMfxs0RZJLOViRn85P1t3SxuDOoRc",
  authDomain: "myeshim-app.firebaseapp.com",
  projectId: "myeshim-app",
  storageBucket: "myeshim-app.firebasestorage.app",
  messagingSenderId: "360259005980",
  appId: "1:360259005980:web:610695f8b44de04dc079d9",
  measurementId: "G-CB0L0ZPC7B"
});

const messaging = firebase.messaging();

function normalizePayload(payload) {
  const root = payload || {};
  const data = root.data || {};
  const notification = root.notification || {};
  return {
    notification: notification,
    data: data
  };
}

function showReminderNotification(payload) {
  const normalized = normalizePayload(payload);
  const notification = normalized.notification;
  const data = normalized.data;
  const title = notification.title || data.title || 'Nezapomeň na dnešní verš 📖';
  const options = {
    body: notification.body || data.body || 'Otevři appku a přečti si dnešní čtení v MYEShim.',
    icon: './icon-192.png',
    badge: './icon-96.png',
    tag: data.tag || 'daily-reminder',
    renotify: false,
    data: {
      ref: data.ref || '',
      url: data.url || 'https://payntrecords-gif.github.io/zjeveni-myeshim/'
    }
  };
  return self.registration.showNotification(title, options);
}

messaging.onBackgroundMessage(function(payload) {
  return showReminderNotification(payload);
});

self.addEventListener('push', function(event) {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch(e) {
    payload = { data: { body: event.data ? event.data.text() : '' } };
  }
  event.waitUntil(showReminderNotification(payload));
});

// Re-subscribe and notify clients when FCM rotates the push subscription (token refresh)
self.addEventListener('pushsubscriptionchange', function(event) {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription
      ? event.oldSubscription.options
      : { userVisibleOnly: true }
    ).then(function() {
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    }).then(function(clientList) {
      clientList.forEach(function(client) {
        client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' });
      });
    }).catch(function(err) {
      console.warn('[firebase-messaging-sw] pushsubscriptionchange: failed to re-subscribe or notify clients:', err);
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const payload = event.notification && event.notification.data ? event.notification.data : {};
  const ref = payload.ref || '';
  const targetUrl = (payload.url || './') + (ref ? '#' + ref : '');
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          if (ref) {
            try { client.postMessage({ type: 'NAVIGATE_TO_REF', ref: ref }); } catch(e) {}
          }
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
