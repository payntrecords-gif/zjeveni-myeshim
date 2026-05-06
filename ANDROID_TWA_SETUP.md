# Android TWA / PWABuilder setup

Tento projekt je připravený jako PWA pro balení do Android aplikace přes PWABuilder a Trusted Web Activity (TWA).

## 1. Co musí být hotové před balením

- PWA musí být veřejně dostupná přes `https://` na produkční doméně.
- Produkční deployment musí servovat `manifest.webmanifest`, `service-worker.js` a všechny ikony bez chyb 404.
- Soubor `/.well-known/assetlinks.json` musí být nasazený na stejné doméně jako PWA.
- `assetlinks.json` musí obsahovat finální Android `package_name` a SHA-256 fingerprint release signing key.

> Bez validního Digital Asset Links ověření se aplikace po zabalení nespustí jako skutečné fullscreen TWA a Android ji otevře jen v režimu Custom Tab s browser UI.

## 2. Připravené soubory v repu

- `manifest.webmanifest` – metadata pro install prompt i desktop install UI
- `screenshots/home-mobile.png` – mobilní screenshot do manifestu
- `screenshots/home-desktop-wide.png` – wide screenshot pro richer desktop install UI
- `/.well-known/assetlinks.json` – template pro Digital Asset Links

## 3. Jak z PWA vyrobit testovací APK přes PWABuilder

1. Nahraj aktuální verzi PWA na produkční nebo staging URL přes `https://`.
2. Otevři [https://www.pwabuilder.com/](https://www.pwabuilder.com/).
3. Zadej URL nasazené PWA a nech proběhnout analýzu.
4. Ověř, že PWABuilder nehlásí chyby kolem manifestu, service workeru a ikon.
5. Zvol **Package for Stores** → **Android**.
6. Vyplň Android package/application ID. Musí být stejné jako `package_name` v `assetlinks.json`.
7. Pro první interní test build použij variantu s podpisem určenou pro testování a vygeneruj **.apk**.
8. APK nainstaluj přímo do zařízení a otestuj chování TWA.

## 4. Kdy použít `.apk` a kdy `.aab`

### `.apk`
Použij pro rychlé lokální a interní testování mimo Google Play. APK se instaluje přímo do zařízení.

### `.aab`
Použij pro vydání do Google Play. Android App Bundle je formát očekávaný Play Console a Play z něj vytvoří cílové APK pro uživatele.

Praktický workflow:

1. nejdřív testovací **APK** pro kontrolu TWA fullscreen režimu a asset links,
2. potom release **AAB** pro Play Store.

## 5. Jak získat SHA-256 fingerprint signing key

### Varianta A – vlastní release keystore
Použij `keytool` nad release keystore:

```bash
keytool -list -v -keystore /cesta/k/release.keystore -alias tvuj-alias
```

Hledej hodnotu `SHA256:`. Tu vlož do `sha256_cert_fingerprints` v `/.well-known/assetlinks.json`.

### Varianta B – Play App Signing
Pokud používáš Google Play App Signing, po založení aplikace otevři v Play Console sekci:

**Setup / App integrity:**

Zkopíruj SHA-256 fingerprint pro app signing key a použij ho v `assetlinks.json`.

## 6. Kam nasadit `assetlinks.json`

Soubor musí být veřejně dostupný přes přesnou URL:

```
https://TVOJE-DOMENA/.well-known/assetlinks.json
```

Po nasazení ověř:

- že vrací HTTP 200,
- že má JSON obsah bez přesměrování,
- že `package_name` odpovídá Android buildu,
- že fingerprint odpovídá release nebo Play signing klíči.

Repo obsahuje placeholder template. Před finálním buildem nahraď:

- `cz.payntrecords.myeshim`
- `REPLACE_WITH_RELEASE_OR_PLAY_APP_SIGNING_SHA256`

## 7. Jak vytvořit finální AAB

1. Potvrď finální `package_name` a signing key.
2. Aktualizuj a nasaď `assetlinks.json`.
3. V PWABuilderu znovu vytvoř Android balíček.
4. Vyber výstup **.aab**.
5. Nahraj AAB do Google Play Console.
6. Pokud Play používá jiný signing fingerprint než lokální test build, znovu zkontroluj `assetlinks.json`.

## 8. Jak ověřit, že TWA běží správně fullscreen

Po instalaci Android buildu do zařízení ověř:

- aplikace se otevírá bez URL baru a bez horního browser UI,
- při navigaci v rámci scope nedochází k pádu zpět do Custom Tab vzhledu,
- launch URL zůstává uvnitř stejné domény a scope,
- `assetlinks.json` je dostupný na produkční doméně.

Pokud se zobrazí browser UI nebo adresní řádek, obvykle je problém v některém z těchto bodů:

- chybí nebo neodpovídá Digital Asset Links,
- package name v Android buildu neodpovídá `assetlinks.json`,
- fingerprint signing key neodpovídá buildu nasazenému v zařízení,
- uživatel byl přesměrovaný mimo deklarovaný scope PWA.

## 9. Doporučený release checklist

- [ ] PWA je nasazená přes HTTPS
- [ ] Manifest a service worker jsou bez chyb
- [ ] `screenshots` v manifestu ukazují reálné UI aplikace
- [ ] `/.well-known/assetlinks.json` je nasazený na produkční doméně
- [ ] `package_name` souhlasí s Android buildem
- [ ] SHA-256 fingerprint souhlasí s release nebo Play signing key
- [ ] Testovací APK se otevírá fullscreen bez browser UI
- [ ] Finální AAB je připravený pro Play Store
