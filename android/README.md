# StudyEarnstay Android app (Google Play)

The app is a **Trusted Web Activity**: it opens studyearnstay.com full-screen, so every website update reaches app users
instantly. No separate app code to maintain.

## One-time setup (on your laptop)

1. Install Node 18+, Java 17 (JDK) and the Bubblewrap CLI:
   ```bash
   npm i -g @bubblewrap/cli
   ```
2. In this folder, create the Android project from the manifest (Bubblewrap downloads the Android SDK the first time):
   ```bash
   cd android
   bubblewrap init --manifest=https://studyearnstay.com/manifest.webmanifest
   ```
   Accept the values from `twa-manifest.json` (package `com.studyearnstay.app`). It creates a signing key `android.keystore`.
   **Back up the keystore and its passwords — you can never update the app without them. Never commit it to Git.**
3. Build:
   ```bash
   bubblewrap build
   ```
   This produces `app-release-bundle.aab` (upload to Play) and `app-release-signed.apk` (install on your phone to test).

## Link the app to the website (removes the browser bar)

1. Play Console → your app → **Test and release → App integrity → App signing** → copy the **SHA-256 certificate fingerprint**
   (also add your upload key's fingerprint from `bubblewrap fingerprint list`).
2. Put them in `web/.env.local` on the server and restart the site:
   ```
   ANDROID_PACKAGE_NAME=com.studyearnstay.app
   ANDROID_SHA256_CERT_FINGERPRINTS=AA:BB:CC:…,DD:EE:FF:…
   ```
3. Check https://studyearnstay.com/.well-known/assetlinks.json shows them.

## Publish

Play Console → Create app → upload the `.aab` to **Internal testing** first, then Production.
You need: app icon 512×512 (`web/public/icons/icon-512.png`), feature graphic 1024×500, at least 2 phone screenshots,
privacy policy URL, and the Data safety form (the app collects email, name, phone for login/applications).

## Updating

Website changes need no app update. Only bump `appVersionCode` in `twa-manifest.json` and run `bubblewrap update && bubblewrap build`
when you change the app name, icon or shortcuts.
