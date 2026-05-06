# FCM Push Notifikace — Návod k nastavení

Tento dokument popisuje, jak nastavit Firebase Cloud Messaging (FCM) pro odesílání denních push notifikací v aplikaci MYEShim.

---

## 1. Vytvoření Firebase projektu

1. Otevři [https://console.firebase.google.com/](https://console.firebase.google.com/) a přihlas se Google účtem.
2. Klikni na **Přidat projekt** a zvol libovolný název (např. `myeshim-app`).
3. Analytiku můžeš přeskočit (není potřeba pro push notifikace).
4. Po vytvoření projektu se dostaneš na **Project Overview**.

---

## 2. Přidání webové aplikace do projektu

1. Na Project Overview klikni na ikonu **`</>`** (Přidat webovou aplikaci).
2. Zadej název aplikace (např. `MYEShim PWA`) a klikni na **Zaregistrovat aplikaci**.
3. Firebase ti zobrazí konfigurační objekt — **zatím ho nechej otevřený**, budeš potřebovat `messagingSenderId`.

---

## 3. Získání VAPID klíče (Web Push Certificate)

1. V Firebase Console přejdi do **Nastavení projektu** (ikona ozubeného kola) → **Cloud Messaging**.
2. Přeroluj dolů na sekci **Web configuration**.
3. V části **Web Push certificates** klikni na **Generate key pair**.
4. Firebase vygeneruje pár klíčů. Zkopíruj hodnotu pod **Key pair** — to je tvůj **VAPID Public Key**.

---

## 4. Nastavení klíčů v aplikaci

> ⚠️ **DŮLEŽITÉ: Bez správných klíčů push notifikace NEFUNGUJÍ**
>
> Otevři `index.html` a najdi blok `<script id="push-config">` (hledej text `push-config`).
> Nahraď obě hodnoty skutečnými klíči ze své Firebase Console:
> ```js
> const VAPID_PUBLIC_KEY = 'PLACEHOLDER_VAPID_KEY';  // ← MUSÍŠ nahradit
> const FCM_SENDER_ID = 'PLACEHOLDER_SENDER_ID';      // ← MUSÍŠ nahradit
> ```
> Pokud tyto hodnoty zůstanou jako placeholder, push subscripce se tiše přeskočí a
> notifikace uživatelé nedostanou. Chyba se zobrazí v DevTools konzoli pod
> `Push sub selhal:`.

Otevři soubor `index.html` a najdi blok `<script id="push-config">`:

```js
const VAPID_PUBLIC_KEY = 'PLACEHOLDER_VAPID_KEY';  // ← nahraď skutečným VAPID Public Key
const FCM_SENDER_ID = 'PLACEHOLDER_SENDER_ID';      // ← nahraď messagingSenderId z Firebase config
```

**Příklad:**
```js
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjZEAba2kCUwl-bvYQHZhLlwdyNbc';
const FCM_SENDER_ID = '1234567890';
```

- `VAPID_PUBLIC_KEY` — zkopíruj z Firebase Console → Project Settings → Cloud Messaging → Web Push certificates → Key pair
- `FCM_SENDER_ID` — zkopíruj z Firebase Console → Project Settings → Cloud Messaging → Sender ID (nebo z konfiguračního objektu jako `messagingSenderId`)

---

## 5. Jak odeslat push notifikaci (manuálně přes Firebase Console)

1. Přejdi do Firebase Console → **Engage** → **Messaging** (nebo **Cloud Messaging**).
2. Klikni na **New campaign** → **Firebase Notification messages**.
3. Vyplň:
   - **Notification title**: `MYEShim – dnešní verš 📖`
   - **Notification text**: text verše (např. `Blahoslavený, kdo předčítá...`)
4. V sekci **Target** zvol **Web push** a zvol svou aplikaci nebo konkrétní topic.
5. Případně nastav **Schedule** pro opakované denní odesílání.
6. Klikni na **Publish** / **Review** a potvrď.

---

## 6. Jak odeslat push notifikaci přes Firebase Functions (automaticky)

Pokud chceš denní automatické notifikace, vytvoř Firebase Function:

```js
// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Denní push notifikace — každý den v 8:00
exports.dailyVerse = functions.pubsub.schedule('0 8 * * *').timeZone('Europe/Prague').onRun(async () => {
  const verses = require('./verses.json'); // JSON s verši (c, v, t)
  const today = Math.floor(Date.now() / 86400000);
  const verse = verses[today % verses.length];

  const message = {
    notification: {
      title: 'MYEShim – dnešní verš 📖',
      body: verse.t,
    },
    data: {
      ref: verse.c + ':' + verse.v,
      verse: verse.t,
    },
    topic: 'daily-verse', // nebo 'all' pro všechny odběratele
    webpush: {
      notification: {
        icon: 'https://TVOJE-DOMENA/icon-192.png',
        badge: 'https://TVOJE-DOMENA/icon-96.png',
        tag: 'myeshim-daily',
      },
    },
  };

  await admin.messaging().send(message);
  console.log('Daily verse push sent:', verse.c + ':' + verse.v);
});
```

**Deployment:**
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only functions
```

---

## 7. Jak odebírat notifikace pomocí topic (doporučeno)

Místo ukládání individuálních subscription objektů můžeš uživatele přihlásit k **FCM topic** `daily-verse`. Potom stačí odeslat zprávu na topic a dostane ji každý odběratel.

Přihlášení k topic se provádí na backendu pomocí Firebase Admin SDK:
```js
admin.messaging().subscribeToTopic(registrationToken, 'daily-verse');
```

---

## 8. Jak otestovat push notifikaci lokálně

### Rychlý test přes Firebase Console
1. Jdi na Firebase Console → Cloud Messaging → New campaign.
2. Zadej název a text, v **Target** vyber **Test on device**.
3. Zkopíruj FCM registration token z DevTools konzole vaší PWA (token se loguje při subscribe).
4. Vlož token do testovacího pole a klikni **Test**.

### Test přes cURL / HTTP API
```bash
curl -X POST https://fcm.googleapis.com/v1/projects/PROJEKT_ID/messages:send \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "token": "FCM_REGISTRATION_TOKEN",
      "notification": {
        "title": "MYEShim – dnešní verš 📖",
        "body": "Blahoslavený, kdo předčítá..."
      },
      "data": {
        "ref": "1:3"
      }
    }
  }'
```

---

## 9. Poznámky k bezpečnosti

- **VAPID Private Key** (serverový klíč) nikdy nevkládej do klientského kódu.
- `VAPID_PUBLIC_KEY` v `index.html` je veřejný klíč — je bezpečné ho zobrazit v kódu.
- `FCM_SENDER_ID` je také veřejná hodnota.
- Serverové klíče (Firebase Admin SDK service account) uchovávej pouze na serveru nebo v GitHub Secrets.

---

## 10. Shrnutí — co kde najít

| Co | Kde najít |
|----|-----------|
| VAPID Public Key | Firebase Console → Project Settings → Cloud Messaging → Web Push certificates |
| Sender ID | Firebase Console → Project Settings → Cloud Messaging → Sender ID |
| Server Key | Firebase Console → Project Settings → Cloud Messaging → Server key (legacy) |
| Service Account | Firebase Console → Project Settings → Service accounts |
