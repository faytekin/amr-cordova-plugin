# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Cordova plugin that wraps the Admost Mediation Router (AMR) ad SDK for both Android and iOS. It exposes banner, interstitial, and rewarded-video ads to a Cordova/JS app. There is no build/test pipeline in this repo: it is consumed by host Cordova apps via `cordova plugin add <repo-url>`. The only local tooling is `prettier` (used to format `www/Amr.js`).

## Architecture

Three layers that must stay in lockstep. A change to one almost always requires the matching change in the others.

1. **JS bridge** (`www/Amr.js`) - clobbered onto `window.plugins.Amr` (see `<js-module>`/`<clobbers>` in `plugin.xml`). Every method is a thin `cordova.exec(success, fail, 'Amr', '<action>', [config])` call. The `<action>` string is the contract with native code.
2. **Android** (`src/android/com/amr/cordova/Amr.java`) - `execute(action, inputs, callbackContext)` dispatches on the action string via an `if/else if` chain (no switch). Action names are `ACTION_*` constants near the top; config keys are `OPT_*` constants. Routed in `plugin.xml` via `<feature name="Amr">` → `com.amr.cordova.Amr`.
3. **iOS** (`src/ios/CDVAmr.m`, `.h`) - class `CDVAmr`. Each action maps to a selector of the same name (e.g. action `loadBanner` → `- (void)loadBanner:(CDVInvokedUrlCommand*)command`). Cordova resolves selector from action name automatically, so the method name MUST equal the JS action string.

When adding or renaming an ad method you touch four places: the JS function in `Amr.js`, the `ACTION_*` constant + dispatch branch in `Amr.java`, and the matching selector in `CDVAmr.m`/`.h`.

### Async results vs. events

Two distinct callback channels - do not confuse them:

- **Command result** - the success/failure of the `cordova.exec` call itself, returned via `CallbackContext`/`CDVPluginResult`. This only reports "the command was accepted/rejected," not ad lifecycle.
- **Ad lifecycle events** - fired as `document` events the host app listens for with `document.addEventListener('onBannerReady', ...)`. Both platforms emit these by injecting `cordova.fireDocumentEvent('<eventName>', <jsonExtra>)`:
  - Android: `sendResponseToListener(event, extra)` → `webView.loadUrl("javascript:...")` (`Amr.java`).
  - iOS: `-fireEvent:withData:` → `commandDelegate evalJs:` (`CDVAmr.m`).

Event names are shared across platforms and are the real API surface for the host app: `onBannerReady`, `onBannerFail`, `onBannerShown`, `onBannerHide`, `onInterstitialReady/Fail/Show/Dismiss/StatusChanged`, `onVideoReady/Fail/Show/Dismiss/Complete/StatusChanged`. Keep the exact spellings identical on both platforms.

### Android `:adprocess` activity

`loadAndShowInterstitial` / `loadAndShowRewardedVideo` do NOT use the in-process AMR listeners. They launch `AmrAdActivity` (declared in `plugin.xml` with `android:process=":adprocess"`, `multiprocess="true"`) via `startActivityForResult`. Results come back through `onActivityResult` (checking `RESULT` extra against `AmrAdActivity.COMPLETED/DISMISS/ON_FAIL`), which then re-fires the same `onVideo*`/`onInterstitial*` document events. `AmrAdActivity` lives in the AMR SDK, not in this repo. The commented-out `FLAG_ACTIVITY_NEW_TASK` lines are intentional - do not re-enable.

## Dependency management (the most common change)

This repo's recurring maintenance is bumping ad SDK / adapter versions and keeping iOS SKAdNetwork identifiers current. All of it lives in `plugin.xml` and the Android gradle file - there is nothing to compile here to verify; correctness is validated downstream in a host app.

- **Android SDK + adapter versions**: `src/android/gradle/amr.gradle` (`dependencies` block - `com.admost.sdk:*` adapters, `play-services-ads`, etc.) and its `repositories` (admost/ironsource/mintegral/pangle mavens). Referenced from `plugin.xml` as a `gradleReference` framework.
- **iOS SDK + adapter versions**: the `<podspec>`/`<pods>` block in `plugin.xml` (`AMRSDK`, `AMRAdapter*`).
- **`SKAdNetworkItems`**: the large array under `<config-file target="*-Info.plist" parent="SKAdNetworkItems">` in `plugin.xml`. This must be kept in sync with Admost's published SKAdNetwork list (see recent commit "Sync SKAdNetworkItems with admost list"). When adding/removing an ad-network adapter, update both the adapter dependency AND this list.
- **Plugin version**: bump `version` in BOTH `plugin.xml` (`<plugin version="...">`) and `package.json` together.

## Conventions

- Android config keys are platform-suffixed: `applicationIdAndroid`, `bannerIdAndroid`, `interstitialIdAndroid`, `videoIdAndroid`. iOS reads its own equivalents in `CDVAmr.m`. The JS layer passes the whole config object through to both.
- Privacy/consent flags (`subjectToGdpr`, `userConsent`, `canRequestAds`) thread from JS config through to the native SDK init and into the `:adprocess` activity extras.
- All native UI/SDK calls run on the UI thread (`cordova.getActivity().runOnUiThread(...)` on Android, main queue on iOS).
