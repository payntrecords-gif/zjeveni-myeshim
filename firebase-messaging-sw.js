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
const APP_ROOT_URL = new URL('./', self.location.href).href;

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
  const targetUrl = resolveNotificationTarget(data);
  const title = notification.title || data.title || 'Nezapomeň na dnešní verš 📖';
  const options = {
    body: notification.body || data.body || 'Otevři appku a přečti si dnešní čtení v iginjaSlovo.',
    icon: './icon-192.png',
    badge: './icon-96.png',
    tag: data.tag || 'daily-reminder',
    renotify: false,
    data: Object.assign({}, data, {
      ref: data.ref || '',
      verseId: data.verseId || '',
      source: data.source || data.type || data.tag || 'daily-reminder',
      url: targetUrl
    })
  };
  return self.registration.showNotification(title, options);
}

function isAppClientUrl(url) {
  try {
    const clientUrl = new URL(url);
    const appUrl = new URL(APP_ROOT_URL);
    return clientUrl.origin === appUrl.origin && clientUrl.pathname.startsWith(appUrl.pathname);
  } catch (error) {
    return false;
  }
}

function resolveNotificationTarget(data) {
  const appUrl = new URL(APP_ROOT_URL);
  const rawUrl = data && typeof data.url === 'string' ? data.url.trim() : '';
  let targetUrl = APP_ROOT_URL;
  try {
    const candidate = new URL(rawUrl || APP_ROOT_URL, APP_ROOT_URL);
    if (candidate.origin === appUrl.origin && candidate.pathname.startsWith(appUrl.pathname)) {
      targetUrl = candidate.href;
    }
  } catch (error) {}
  if (data && data.ref) {
    const candidate = new URL(targetUrl);
    if (!candidate.hash) candidate.hash = data.ref;
    targetUrl = candidate.href;
  }
  return targetUrl;
}

function postNotificationTarget(client, data, targetUrl) {
  if (!client || typeof client.postMessage !== 'function') return;
  try {
    client.postMessage({
      type: 'NAVIGATE_TO_NOTIFICATION',
      targetUrl: targetUrl,
      data: data || {}
    });
  } catch (error) {}
  if (!data || !data.ref) return;
  try {
    client.postMessage({
      type: 'NAVIGATE_TO_REF',
      ref: data.ref,
      data: data
    });
  } catch (error) {}
}

async function openNotificationWindow(targetUrl) {
  try {
    return await clients.openWindow(targetUrl);
  } catch (error) {
    if (targetUrl === APP_ROOT_URL) return null;
  }
  try {
    return await clients.openWindow(APP_ROOT_URL);
  } catch (error) {
    return null;
  }
}

async function activateNotificationTarget(targetUrl, data) {
  const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  const appClients = windowClients.filter(client => isAppClientUrl(client.url));
  const activeClient = appClients.find(client => client.url === targetUrl) || appClients[0];
  if (!activeClient) return openNotificationWindow(targetUrl);

  let clientRef = activeClient;
  let currentUrl = clientRef.url || '';
  try {
    currentUrl = new URL(currentUrl).href;
  } catch (error) {}
  if (currentUrl !== targetUrl) {
    if (typeof clientRef.navigate === 'function') {
      try {
        const navigatedClient = await clientRef.navigate(targetUrl);
        if (navigatedClient) clientRef = navigatedClient;
      } catch (error) {
        return openNotificationWindow(targetUrl);
      }
    } else {
      try {
        const current = new URL(currentUrl, APP_ROOT_URL);
        const target = new URL(targetUrl, APP_ROOT_URL);
        if (current.origin !== target.origin || current.pathname !== target.pathname || current.search !== target.search) {
          return openNotificationWindow(targetUrl);
        }
      } catch (error) {
        return openNotificationWindow(targetUrl);
      }
      postNotificationTarget(clientRef, data, targetUrl);
    }
  }

  if (typeof clientRef.focus === 'function') {
    try {
      const focusedClient = await clientRef.focus();
      if (focusedClient) clientRef = focusedClient;
    } catch (error) {
      return openNotificationWindow(targetUrl);
    }
  }

  postNotificationTarget(clientRef, data, targetUrl);
  return clientRef;
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
  const data = event.notification && event.notification.data ? event.notification.data : {};
  const targetUrl = resolveNotificationTarget(data);
  event.waitUntil(activateNotificationTarget(targetUrl, data));
});
