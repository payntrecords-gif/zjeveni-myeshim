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

messaging.onBackgroundMessage(function(payload) {
  const notification = payload && payload.notification ? payload.notification : {};
  const data = payload && payload.data ? payload.data : {};
  const title = notification.title || data.title || 'MYEShim – dnešní verš 📖';
  const options = {
    body: notification.body || data.body || 'Otevři appku a přečti si dnešní verš.',
    icon: './icon-192.png',
    badge: './icon-96.png',
    tag: data.tag || 'myeshim-daily'
  };
  self.registration.showNotification(title, options);
});
