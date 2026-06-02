#!/usr/bin/env bun
/**
 * check-versions.ts - reads the AMR dependency versions currently pinned in this
 * repo and compares them against the authoritative package registries, then
 * prints a "current -> latest" table. It does NOT edit any files; the /update-amr
 * skill drives the edits after the user confirms the diff.
 *
 * Run from the repo root:
 *   bun .claude/skills/update-amr/check-versions.ts
 * (bun runs the TypeScript directly. node >= 23.6 also works, or node 22.6-23.5
 * with --experimental-strip-types.)
 *
 * Sources of truth (all machine-readable, far more reliable than scraping the
 * admost.github.io docs pages, which generate their dependency block client-side):
 *   - iOS pods            -> CocoaPods trunk API (trunk.cocoapods.org)
 *   - com.admost.sdk:*    -> admost Artifactory maven-metadata (<release> tag)
 *   - play-services/androidx -> Google maven-metadata (latest STABLE version)
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

type Source = "cocoapods" | "admost" | "google";
type Status = "ok" | "update" | "error";

interface Row {
  group: string; // "ios" | "android-admost" | "android-google"
  display: string;
  current: string;
  latest: string;
  status: Status;
  source: Source;
  note: string;
}

const ADMOST_MAVEN = "https://mvn-repo.admost.com/artifactory/amr-2";
const GOOGLE_MAVEN = "https://dl.google.com/dl/android/maven2";
const COCOAPODS = "https://trunk.cocoapods.org/api/v1/pods";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const gradlePath = resolve(repoRoot, "src/android/gradle/amr.gradle");
const pluginPath = resolve(repoRoot, "plugin.xml");

// --- version helpers ---------------------------------------------------------

// Numeric segments of a version, e.g. "24.0.0.5.a49" -> [24,0,0,5,49].
function segs(v: string): number[] {
  return (v.match(/\d+/g) ?? []).map(Number);
}

function cmp(a: string, b: string): number {
  const x = segs(a);
  const y = segs(b);
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

// Google's <release> can point at a prerelease (e.g. appcompat 1.8.0-alpha01),
// so we always filter these out and take the latest stable from <versions>.
function isPrerelease(v: string): boolean {
  // No word boundaries: registries tack the qualifier straight onto digits
  // (e.g. "1.8.0-alpha01", "1.10.0-rc01"). admost's ".a49" build suffix is not
  // matched here, and admost versions are taken from <release> anyway.
  return /(alpha|beta|rc|snapshot|dev|preview|eap|canary)/i.test(v);
}

function latestStable(versions: string[]): string | null {
  const stable = versions.filter((v) => !isPrerelease(v)).sort(cmp);
  return stable.length ? stable[stable.length - 1] : null;
}

function major(v: string): number {
  return segs(v)[0] ?? 0;
}

// --- fetchers ----------------------------------------------------------------

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

async function cocoapodsVersions(pod: string): Promise<string[]> {
  const json = JSON.parse(await fetchText(`${COCOAPODS}/${pod}`));
  return (json.versions ?? []).map((v: { name: string }) => v.name);
}

interface MavenMeta {
  release: string | null;
  versions: string[];
}

async function mavenMeta(base: string, group: string, artifact: string): Promise<MavenMeta> {
  const path = group.replace(/\./g, "/");
  const xml = await fetchText(`${base}/${path}/${artifact}/maven-metadata.xml`);
  const release = xml.match(/<release>([^<]+)<\/release>/)?.[1] ?? null;
  const versions = [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map((m) => m[1]);
  return { release, versions };
}

// --- parse current pins from the repo ---------------------------------------

interface GradleDep {
  group: string;
  artifact: string;
  version: string;
}

function parseGradle(): GradleDep[] {
  const text = readFileSync(gradlePath, "utf8");
  const deps: GradleDep[] = [];
  for (const m of text.matchAll(/implementation\s+'([^:']+):([^:']+):([^']+)'/g)) {
    deps.push({ group: m[1], artifact: m[2], version: m[3] });
  }
  return deps;
}

interface PodDep {
  name: string;
  spec: string; // floor, e.g. "13.1"
}

function parsePods(): PodDep[] {
  const text = readFileSync(pluginPath, "utf8");
  const pods: PodDep[] = [];
  for (const m of text.matchAll(/<pod\s+name="([^"]+)"\s+spec="~>\s*([^"]+)"\s*\/>/g)) {
    pods.push({ name: m[1], spec: m[2].trim() });
  }
  return pods;
}

// --- build rows --------------------------------------------------------------

async function androidRows(): Promise<Row[]> {
  const deps = parseGradle();
  // play-services-ads must stay within the AdMob adapter's major so it stays
  // compatible with the bundled AdMob SDK (the admost docs page pins it the
  // same way - it does NOT jump play-services-ads to a new major on its own).
  const admob = deps.find((d) => d.artifact === "admob-adapter");
  const admobMajor = admob ? major(admob.version) : null;

  const rows: Row[] = [];
  for (const d of deps) {
    const coord = `${d.group}:${d.artifact}`;
    const isAdmost = d.group.startsWith("com.admost.sdk");
    const base = isAdmost ? ADMOST_MAVEN : GOOGLE_MAVEN;
    const source: Source = isAdmost ? "admost" : "google";
    let latest = "";
    let note = "";
    try {
      const meta = await mavenMeta(base, d.group, d.artifact);
      if (isAdmost) {
        // <release> is admost-curated and keeps the .aNN build suffix.
        latest = meta.release ?? latestStable(meta.versions) ?? "";
      } else if (d.artifact === "play-services-ads" && admobMajor != null) {
        const inMajor = meta.versions.filter((v) => major(v) === admobMajor && !isPrerelease(v)).sort(cmp);
        latest = inMajor.length ? inMajor[inMajor.length - 1] : "";
        const absolute = latestStable(meta.versions);
        if (absolute && latest && cmp(absolute, latest) > 0) {
          note = `pinned to ${admobMajor}.x for AdMob adapter; absolute latest is ${absolute}`;
        }
      } else {
        latest = latestStable(meta.versions) ?? "";
      }
    } catch (e) {
      rows.push({ group: "android-" + source, display: coord, current: d.version, latest: "ERR", status: "error", source, note: String(e) });
      continue;
    }
    const status: Status = !latest ? "error" : cmp(latest, d.version) > 0 ? "update" : "ok";
    rows.push({ group: "android-" + source, display: coord, current: d.version, latest, status, source, note });
  }
  return rows;
}

async function iosRows(): Promise<Row[]> {
  const pods = parsePods();
  const rows: Row[] = [];
  for (const p of pods) {
    let latest = "";
    let note = "";
    let status: Status = "ok";
    try {
      latest = latestStable(await cocoapodsVersions(p.name)) ?? "";
      // "~> X.Y" already covers any X.* release, so the spec only needs editing
      // when the latest crosses into a new MAJOR. Otherwise it auto-resolves.
      if (latest && major(latest) > major(p.spec)) {
        status = "update";
        note = `latest ${latest} is a new major; bump spec floor`;
      } else if (latest) {
        note = `resolves to ${latest}`;
      } else {
        status = "error";
      }
    } catch (e) {
      status = "error";
      note = String(e);
    }
    rows.push({ group: "ios", display: p.name, current: `~> ${p.spec}`, latest, status, source: "cocoapods", note });
  }
  return rows;
}

// --- output ------------------------------------------------------------------

function printGroup(title: string, rows: Row[]): void {
  if (!rows.length) return;
  console.log(`\n${title}`);
  const wD = Math.max(...rows.map((r) => r.display.length), 8);
  const wC = Math.max(...rows.map((r) => r.current.length), 7);
  const wL = Math.max(...rows.map((r) => r.latest.length), 6);
  for (const r of rows) {
    const mark = r.status === "update" ? "UPDATE" : r.status === "error" ? "ERR " : "ok  ";
    const note = r.note ? `  (${r.note})` : "";
    console.log(`  ${mark}  ${r.display.padEnd(wD)}  ${r.current.padEnd(wC)} -> ${r.latest.padEnd(wL)}${note}`);
  }
}

async function main(): Promise<void> {
  const [ios, android] = await Promise.all([iosRows(), androidRows()]);
  printGroup("iOS pods (plugin.xml)", ios);
  printGroup("Android admost (amr.gradle)", android.filter((r) => r.source === "admost"));
  printGroup("Android google/androidx (amr.gradle)", android.filter((r) => r.source === "google"));

  const updates = [...ios, ...android].filter((r) => r.status === "update");
  const errors = [...ios, ...android].filter((r) => r.status === "error");
  console.log(`\n${updates.length} update(s) available, ${errors.length} error(s).`);
  if (updates.length) {
    console.log("Updates:");
    for (const r of updates) console.log(`  ${r.display}: ${r.current} -> ${r.latest}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
