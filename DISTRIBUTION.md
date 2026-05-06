# Distribuce MYEShim — bez Google Play Store

Tato aplikace **není** na veřejném Google Play Store. Je to záměrné rozhodnutí — MYEShim je soukromá aplikace pro uzavřenou skupinu lidí (komunitu, sbor, studijní skupinu).

---

## Proč není na Play Store?

- Jedná se o **soukromou komunitní aplikaci** — není určena pro veřejnost.
- Play Store vyžaduje splnění přísných podmínek (politiky obsahu, poplatky za vývojářský účet, review proces), které jsou zbytečné pro interní použití.
- Distribuce přes APK nebo Firebase App Distribution je pro uzavřenou skupinu lidí rychlejší a jednodušší.
- Obsah aplikace (texty, poznámky, komentáře) je specifický pro danou komunitu.

---

## Varianta A — Přímý APK (sideloading)

Tato varianta funguje pro **Android** zařízení.

### Krok 1: Vytvoření APK

Použij [PWABuilder](https://www.pwabuilder.com/) pro vygenerování APK z PWA:

1. Nasaď aplikaci na HTTPS URL (např. přes GitHub Pages, Netlify, nebo vlastní server).
2. Otevři [https://www.pwabuilder.com/](https://www.pwabuilder.com/).
3. Zadej URL a nech proběhnout analýzu.
4. Zvol **Package for Stores** → **Android** → stáhni APK.

Podrobnější postup je v souboru [`ANDROID_TWA_SETUP.md`](./ANDROID_TWA_SETUP.md).

### Krok 2: Sdílení APK souboru

Soubor `.apk` sdílej přímo (např. přes WhatsApp, e-mail, Google Drive, OneDrive nebo vlastní server).

Doporučené umístění pro sdílení:
- **Google Drive** — sdílej odkaz s konkrétními lidmi (ne jako veřejný odkaz)
- **WhatsApp/Telegram skupina** — pošli APK přímo do skupiny komunity
- **Vlastní web/server** — vlož APK jako soubor ke stažení

### Krok 3: Instalace na Android

Příjemce musí na svém zařízení povolit **instalaci z neznámých zdrojů**:

1. Stáhni APK soubor do telefonu.
2. Otevři soubor (Správce souborů → Stažené soubory → název souboru).
3. Android zobrazí varování: *„Instalovat aplikace z tohoto zdroje?"*
4. Klikni na **Nastavení** a povol **Instalovat neznámé aplikace** pro daný prohlížeč/správce souborů.
5. Vrať se zpět a pokračuj v instalaci.
6. Po instalaci najdeš MYEShim na ploše nebo v seznamu aplikací.

> **Poznámka:** Přesný postup se mírně liší podle verze Androidu a výrobce (Samsung, Xiaomi, atd.). Hledej v nastavení zařízení výraz „neznámé zdroje" nebo „instalace z externích zdrojů".

---

## Varianta B — Firebase App Distribution

Firebase App Distribution umožňuje pozvat konkrétní uživatele e-mailem a distribuovat jim testovací verze aplikace.

### Nastavení

1. Otevři [https://console.firebase.google.com/](https://console.firebase.google.com/) a přejdi do svého projektu.
2. V levém menu přejdi do **Release & Monitor** → **App Distribution**.
3. Klikni na **Get started**.

### Přidání APK

1. Vytvoř APK soubor (viz Varianta A, Krok 1).
2. V App Distribution klikni na **Upload** a nahraj APK.

### Pozvání uživatelů

1. Klikni na **Testers & Groups**.
2. Klikni na **Add testers** a zadej e-mailové adresy členů komunity.
3. Nebo vytvoř skupinu (např. `komunita`) a přidej do ní testery.
4. Po nahrání APK zvol skupinu/testery a klikni na **Distribute**.

### Co obdrží uživatelé

- Každý pozvaný uživatel dostane e-mail s odkazem na instalaci.
- Musí si nainstalovat aplikaci **Firebase App Tester** (dostupná na Play Store).
- Přes App Tester si stáhnou a nainstalují MYEShim.
- Při nové verzi dostanou automatické upozornění.

---

## iOS — pouze PWA přes Safari

Na iOS **nelze distribuovat** nativní APK. Jedinou možností je instalace PWA (Progressive Web App) přes Safari.

### Jak nainstalovat MYEShim na iOS

1. Otevři **Safari** na iPhonu nebo iPadu (jiné prohlížeče na iOS nepodporují přidání PWA na plochu).
2. Přejdi na URL aplikace MYEShim (např. `https://myeshim.example.com`).
3. Klepni na ikonu **Sdílet** (čtverec se šipkou nahoru `□↑`) ve spodní liště.
4. Přeroluj dolů a zvol **„Přidat na plochu"** (*Add to Home Screen*).
5. Uprav název pokud chceš a klepni na **Přidat**.
6. MYEShim se objeví na ploše jako ikona aplikace.

> **Poznámka:** PWA na iOS má omezení oproti Android verzi — push notifikace nejsou na starších iOS plně podporovány (iOS 16.4+ přidalo základní podporu Web Push pro přidané PWA).

### Sdílení odkazu s iOS uživateli

Pošli uživatelům přímý odkaz na aplikaci. Instrukce výše jim vysvětlí, jak si ji přidat na plochu.

---

## Shrnutí — přehled metod distribuce

| Platforma | Metoda | Výhody | Nevýhody |
|-----------|--------|--------|----------|
| Android | Přímý APK (sideloading) | Rychlé, bez registrace | Je potřeba povolit neznámé zdroje |
| Android | Firebase App Distribution | Profesionální, automatické aktualizace | Vyžaduje Firebase projekt + App Tester |
| iOS | PWA přes Safari | Žádná instalace z externího zdroje | Omezená funkcionalita vs. nativní app |
| Desktop | PWA install banner | Automaticky nabídnuto prohlížečem | Závisí na podpoře prohlížeče |

---

## Aktualizace aplikace

- **APK (sideloading):** Nahraj nový APK a znovu ho rozešli uživatelům. Musí ho ručně reinstalovat.
- **Firebase App Distribution:** Nahraj novou verzi do Firebase Console — uživatelé dostanou e-mail s aktualizací.
- **PWA:** Aktualizace probíhá automaticky při dalším otevření aplikace (Service Worker stáhne novou verzi na pozadí).
