---
name: update-amr
description: Check for and apply AMR (Admost Mediation Router) ad SDK version updates in this Cordova plugin. Use when asked to update/bump the AMR SDK, ad adapter versions, CocoaPods, or gradle dependencies in plugin.xml and src/android/gradle/amr.gradle.
---

# update-amr

Updates the pinned AMR ad SDK / adapter versions in this plugin by comparing what
is committed against the authoritative package registries, then editing the two
dependency files after the user confirms the diff.

## Why registries, not the docs page

The admost docs pages (`admost.github.io/amrios`, `admost.github.io/amrandroid`)
generate their dependency block with client-side JavaScript - the versions are
not in the page HTML and cannot be scraped reliably. They also lag the registries
(observed: the page showed `admob-adapter:24.0.0.1.a49` while maven already had
`24.0.0.5.a49`). So the source of truth is:

- **iOS pods** -> CocoaPods trunk API (`trunk.cocoapods.org/api/v1/pods/<POD>`)
- **`com.admost.sdk:*`** -> admost Artifactory `maven-metadata.xml` `<release>` tag (admost-curated, keeps the `.aNN` build suffix)
- **play-services / androidx** -> Google `maven-metadata.xml`, latest **stable** version

## Steps

1. **Check versions.** From the repo root run:
   ```bash
   bun .claude/skills/update-amr/check-versions.ts
   ```
   (Runs the TypeScript directly, no install or build step. `node` also works on
   Node >= 23.6, or with `--experimental-strip-types` on 22.6-23.5.)
   It reads the current pins from `plugin.xml` and `src/android/gradle/amr.gradle`,
   queries the registries, and prints a `current -> latest` table with `UPDATE`
   markers. It edits nothing.

2. **Show the table to the user** and list the available updates. Then **ask for
   confirmation** before editing anything. Do not auto-apply.

3. **Apply confirmed updates** with the Edit tool:
   - Android: edit the matching `implementation '...'` line in `src/android/gradle/amr.gradle`.
   - iOS: edit the `<pod name="..." spec="~> X.Y" />` line in `plugin.xml`. Note the
     `~> X.Y` operator already covers every `X.*` release, so an iOS pod only needs
     editing when the script reports a **new major** (status `UPDATE`); a patch/minor
     bump within the same major resolves automatically and the script marks it `ok`.

4. **Bump the plugin version** when any dependency changed: increment `version` in
   BOTH `plugin.xml` (`<plugin ... version="X.Y.Z">`) and `package.json` together.

5. **Commit** (only if the user asks). Conventional Commits, e.g.
   `chore: bump amr adapter versions`.

## Compatibility rules the script enforces (keep these if editing manually)

- **`com.admost.sdk:*` adapters**: use the maven `<release>` value verbatim, including
  the `.aNN` suffix. Do not hand-pick a higher raw version - the suffixed releases are
  a coordinated set.
- **`play-services-ads`**: stays within the **same major** as `admob-adapter` (e.g.
  adapter `24.0.0.x` -> latest `play-services-ads` `24.x`, currently `24.9.0`). Never
  jump it to a new major (`25.x`) on its own - it must match the bundled AdMob SDK.
- **Google / androidx**: latest **stable** only; prereleases (`alpha`/`beta`/`rc`) are
  skipped. These are lower-risk extras the cordova plugin adds on top of admost's set;
  bumping them is optional - surface them but let the user decide.

## Out of scope

The `SKAdNetworkItems` array in `plugin.xml` is synced separately from admost's
published list and is not handled by this skill.
