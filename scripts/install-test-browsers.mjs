#!/usr/bin/env node
/**
 * Keeps every attached Android target in sync with the APKs sitting in `apks/`,
 * so the emulator has the browsers we test hand-off against - notably the
 * `/account` path, which the shell deliberately does NOT claim as a deep link
 * (App Store compliance keeps subscription management in the system browser).
 *
 * The folder is the source of truth and is scanned recursively. Drop an APK in
 * and the next run installs it; delete one and the next run uninstalls it from
 * the devices that got it from here. State lives in `apks/manifest.json`, a
 * catalog of what is in the folder plus, per device serial, what the folder
 * owns there and from which file. A package is only ever uninstalled if the
 * manifest says the folder owns it - either we installed it, or it was already
 * on the device while its APK sat in `apks/` (adopted on first sync). A browser
 * with no APK in the folder is never touched.
 *
 * Get the APKs from https://apkmirror.com (Firefox, Waterfox, Chrome, Brave and
 * friends all live there) and drop the downloads into `apks/`. That directory
 * is gitignored: the files are hundreds of MB, so it does not exist on a fresh
 * clone and everything here degrades to a warning when it, the SDK, or a device
 * is missing. `npm run android` must never fail over a convenience browser.
 *
 * Two payload shapes are supported:
 *   - `.apk`  - a universal APK, installed directly.
 *   - `.apkm` / `.apks` / `.xapk` - an apkmirror/bundletool split archive. Only
 *     base.apk plus the splits matching the device's ABI and screen density are
 *     extracted; installing every split at once conflicts.
 *
 * Env:
 *   SKIP_TEST_BROWSERS=1     do nothing at all
 *   REINSTALL_TEST_BROWSERS=1 reinstall even when the device already has it
 *   --dry-run                report the plan without touching any device
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apksDir = join(repoRoot, 'apks');
const manifestPath = join(apksDir, 'manifest.json');
const MANIFEST_VERSION = 2;
const BUNDLE_EXTENSIONS = ['.apkm', '.apks', '.xapk'];

const force = process.env.REINSTALL_TEST_BROWSERS === '1';
const dryRun = process.argv.includes('--dry-run') || process.env.TEST_BROWSERS_DRY_RUN === '1';

/** Density buckets, in the order bundletool names them. */
const DENSITY_BUCKETS = [
  ['ldpi', 120],
  ['mdpi', 160],
  ['tvdpi', 213],
  ['hdpi', 240],
  ['xhdpi', 320],
  ['xxhdpi', 480],
  ['xxxhdpi', 640],
];

function warn(message) {
  console.warn(`[test-browsers] ${message}`);
}

function info(message) {
  console.log(`[test-browsers] ${message}`);
}

function findAdb() {
  const sdkRoots = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    join(homedir(), 'Library/Android/sdk'),
    join(homedir(), 'Android/Sdk'),
  ].filter(Boolean);
  for (const root of sdkRoots) {
    const candidate = join(root, 'platform-tools', 'adb');
    if (existsSync(candidate)) return candidate;
  }
  try {
    return execFileSync('which', ['adb'], { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

/** Newest build-tools aapt2, used to read package ids straight out of an APK. */
function findAapt2() {
  const sdkRoots = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    join(homedir(), 'Library/Android/sdk'),
    join(homedir(), 'Android/Sdk'),
  ].filter(Boolean);
  for (const root of sdkRoots) {
    const buildTools = join(root, 'build-tools');
    if (!existsSync(buildTools)) continue;
    const versions = readdirSync(buildTools).sort().reverse();
    for (const version of versions) {
      const candidate = join(buildTools, version, 'aapt2');
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function adbOut(adb, args) {
  return execFileSync(adb, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

function attachedDevices(adb) {
  return adbOut(adb, ['devices'])
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state === 'device')
    .map(([serial]) => serial);
}

export function isBundle(fileName) {
  return BUNDLE_EXTENSIONS.some((ext) => fileName.toLowerCase().endsWith(ext));
}

/** apkmirror names files `<package>_<version>_<...>.apk` - the fallback source. */
export function packageNameFromFile(fileName) {
  const head = fileName.split(sep).pop().split('_')[0];
  return /^[A-Za-z][\w]*(\.[\w]+)+$/.test(head) ? head : null;
}

export function densityBucketFor(density) {
  if (!density) return 'xxhdpi';
  const exact = DENSITY_BUCKETS.find(([, dpi]) => dpi === density);
  if (exact) return exact[0];
  // Android rounds up to the next bucket it has assets for.
  const next = DENSITY_BUCKETS.find(([, dpi]) => dpi >= density);
  return (next ?? DENSITY_BUCKETS[DENSITY_BUCKETS.length - 1])[0];
}

function deviceDensityBucket(adb, serial) {
  let density = 0;
  try {
    const out = adbOut(adb, ['-s', serial, 'shell', 'wm', 'density']);
    // "Override density" wins when the emulator was resized.
    const override = out.match(/Override density:\s*(\d+)/);
    const physical = out.match(/Physical density:\s*(\d+)/);
    density = Number((override ?? physical)?.[1] ?? 0);
  } catch {
    /* fall through to the default bucket */
  }
  return densityBucketFor(density);
}

function deviceAbis(adb, serial) {
  const list = adbOut(adb, ['-s', serial, 'shell', 'getprop', 'ro.product.cpu.abilist']).trim();
  if (list) return list.split(',').map((abi) => abi.trim()).filter(Boolean);
  const single = adbOut(adb, ['-s', serial, 'shell', 'getprop', 'ro.product.cpu.abi']).trim();
  return single ? [single] : [];
}

function installedPackages(adb, serial) {
  const out = adbOut(adb, ['-s', serial, 'shell', 'pm', 'list', 'packages']);
  return new Set(
    out
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('package:'))
      .map((line) => line.slice('package:'.length)),
  );
}

function bundleEntries(archive) {
  return execFileSync('unzip', ['-Z', '-1', archive], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.endsWith('.apk'));
}

/** base.apk + the one ABI split and one density split this device can use. */
export function splitsForDevice(entries, abis, densityBucket) {
  const base = entries.find((entry) => entry.endsWith('base.apk'));
  if (!base) return null;
  const configName = (suffix) =>
    entries.find((entry) => entry.replace(/-/g, '_').endsWith(`config.${suffix}.apk`));

  const abiSplit = abis.map((abi) => configName(abi.replace(/-/g, '_'))).find(Boolean);
  const densitySplit = configName(densityBucket);

  const chosen = [base, abiSplit, densitySplit].filter(Boolean);
  // Anything left that isn't a config split (language packs, feature modules)
  // is architecture-neutral and safe to bring along.
  const extras = entries.filter(
    (entry) => !chosen.includes(entry) && !/config\.[\w]+\.apk$/.test(entry.replace(/-/g, '_')),
  );
  return { paths: [...chosen, ...extras], abiSplit, densitySplit };
}

/** apkmirror bundles carry their identity in info.json - use it when present. */
function bundleMetadata(file) {
  try {
    const raw = execFileSync('unzip', ['-p', file, 'info.json'], {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
    const parsed = JSON.parse(raw);
    return {
      package: parsed.pname || null,
      label: parsed.app_name || null,
      version: parsed.release_version || null,
    };
  } catch {
    return { package: null, label: null, version: null };
  }
}

/** Plain APKs have no info.json, so read identity out of the manifest itself. */
function apkMetadata(aapt2, file) {
  const empty = { package: null, label: null, version: null };
  if (!aapt2) return empty;
  try {
    const badging = execFileSync(aapt2, ['dump', 'badging', file], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 8 * 1024 * 1024,
    });
    return {
      package: badging.match(/^package: name='([^']+)'/m)?.[1] ?? null,
      label: badging.match(/^application-label:'([^']*)'/m)?.[1] || null,
      version: badging.match(/versionName='([^']*)'/)?.[1] || null,
    };
  } catch {
    /* badging can choke on odd resources; the package id alone still helps */
  }
  try {
    return {
      ...empty,
      package: execFileSync(aapt2, ['dump', 'packagename', file], { encoding: 'utf8' }).trim() || null,
    };
  } catch {
    return empty;
  }
}

function walkApks(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walkApks(full));
    } else if (entry.name.toLowerCase().endsWith('.apk') || isBundle(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

/** The folder, catalogued: one entry per APK, package id resolved. */
function scanCatalog(aapt2) {
  const aapt2Path = aapt2 ?? findAapt2();
  return walkApks(apksDir)
    .sort()
    .map((full) => {
      const file = relative(apksDir, full);
      const stats = statSync(full);
      const bundle = isBundle(file);
      const meta = bundle ? bundleMetadata(full) : apkMetadata(aapt2Path, full);
      return {
        file,
        package: meta.package ?? packageNameFromFile(file),
        label: meta.label,
        version: meta.version,
        format: bundle ? 'bundle' : 'apk',
        size: stats.size,
        mtime: Math.floor(stats.mtimeMs),
      };
    });
}

export function emptyManifest() {
  return { version: MANIFEST_VERSION, updatedAt: null, catalog: [], devices: {} };
}

function readManifest() {
  if (!existsSync(manifestPath)) return emptyManifest();
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (parsed?.version !== MANIFEST_VERSION) {
      warn('manifest.json is from an older version - rebuilding it');
      return emptyManifest();
    }
    return { ...emptyManifest(), ...parsed };
  } catch (error) {
    warn(`manifest.json unreadable (${error.message}) - rebuilding it`);
    return emptyManifest();
  }
}

function writeManifest(manifest, now) {
  if (dryRun) return;
  writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, updatedAt: now }, null, 2)}\n`);
}

/**
 * What this device needs to reach the state the folder describes.
 *
 * `recorded` is keyed by the file path we installed from, so a re-downloaded
 * (bigger/newer) APK counts as changed and a deleted file still knows which
 * package to remove. Only records we marked `managed` are ever uninstalled.
 */
export function reconcile({ catalog, recorded = {}, installed, force: forceAll = false }) {
  const plan = { install: [], uninstall: [], skip: [] };
  const inFolder = new Set(catalog.map((entry) => entry.file));

  for (const entry of catalog) {
    const record = recorded[entry.file];
    const onDevice = entry.package ? installed.has(entry.package) : false;
    const changed = record ? record.size !== entry.size || record.mtime !== entry.mtime : false;

    if (forceAll) plan.install.push({ entry, reason: 'forced' });
    else if (changed) plan.install.push({ entry, reason: 'file changed' });
    else if (!entry.package) plan.install.push({ entry, reason: 'package id unknown' });
    else if (!onDevice) plan.install.push({ entry, reason: record ? 'removed from device' : 'new' });
    // Already there and untracked: the folder claims it, so a later deletion of
    // the file can take it back off the device. Adoption needs a file in
    // `apks/` naming the package - it never reaches beyond the folder.
    else plan.skip.push({ entry, reason: 'already installed', adopt: !record });
  }

  const packagesInFolder = new Set(catalog.map((entry) => entry.package).filter(Boolean));

  for (const [file, record] of Object.entries(recorded)) {
    if (inFolder.has(file)) continue;
    if (record.package && packagesInFolder.has(record.package)) {
      // Same package, different path: the file was moved or re-downloaded, not
      // deleted. Tearing it off the device just to put it back would be silly -
      // the catalog pass above already installs/adopts it under the new name.
      plan.skip.push({ entry: { file, package: record.package }, reason: 'moved within apks/', prune: true });
    } else if (!record.managed || !record.package) {
      plan.skip.push({
        entry: { file, package: record.package },
        reason: 'gone from apks/, not ours to remove',
        prune: true,
      });
    } else if (!installed.has(record.package)) {
      plan.skip.push({
        entry: { file, package: record.package },
        reason: 'gone from apks/, already off device',
        prune: true,
      });
    } else {
      plan.uninstall.push({ file, package: record.package, reason: 'removed from apks/' });
    }
  }

  return plan;
}

function installUniversal(adb, serial, file) {
  execFileSync(adb, ['-s', serial, 'install', '-r', '-g', file], { stdio: 'inherit' });
}

function installBundle(adb, serial, file) {
  const entries = bundleEntries(file);
  const selection = splitsForDevice(entries, deviceAbis(adb, serial), deviceDensityBucket(adb, serial));
  if (!selection) throw new Error('no base.apk inside the bundle');
  if (!selection.abiSplit) {
    warn(`${file}: no ABI split matches ${serial}, installing base only (it may not run)`);
  }
  const staging = mkdtempSync(join(tmpdir(), 'sprout-apkm-'));
  try {
    execFileSync('unzip', ['-o', '-q', '-j', file, ...selection.paths, '-d', staging], { stdio: 'inherit' });
    const staged = selection.paths.map((entry) => join(staging, entry.split('/').pop()));
    execFileSync(adb, ['-s', serial, 'install-multiple', '-r', '-g', ...staged], { stdio: 'inherit' });
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

function applyPlan(adb, serial, plan, records, now) {
  for (const { entry, reason, adopt, prune } of plan.skip) {
    info(`${serial}: ${entry.package ?? entry.file} - ${reason}${adopt ? ', adopting into the manifest' : ''}`);
    // The file backing this record is gone, so the record has nothing left to
    // reconcile against - drop it instead of re-reporting it every run.
    if (prune && !dryRun) delete records[entry.file];
    if (adopt && entry.package && !dryRun) {
      records[entry.file] = {
        package: entry.package,
        size: entry.size,
        mtime: entry.mtime,
        managed: true,
        adopted: true,
        installedAt: now,
      };
    }
  }

  for (const { file, package: pkg, reason } of plan.uninstall) {
    info(`${serial}: uninstalling ${pkg} (${reason})${dryRun ? ' [dry run]' : ''}`);
    if (dryRun) continue;
    try {
      execFileSync(adb, ['-s', serial, 'uninstall', pkg], { stdio: 'inherit' });
      delete records[file];
    } catch (error) {
      warn(`${serial}: failed to uninstall ${pkg} - ${error.message}`);
    }
  }

  for (const { entry, reason } of plan.install) {
    const name = entry.label ? `${entry.label} ${entry.version ?? ''}`.trim() : entry.file;
    info(`${serial}: installing ${name} (${reason}) - this is large, be patient${dryRun ? ' [dry run]' : ''}`);
    if (dryRun) continue;
    try {
      const full = join(apksDir, entry.file);
      if (entry.format === 'bundle') installBundle(adb, serial, full);
      else installUniversal(adb, serial, full);
      records[entry.file] = {
        package: entry.package,
        size: entry.size,
        mtime: entry.mtime,
        managed: true,
        installedAt: now,
      };
      info(`${serial}: installed ${entry.package ?? entry.file}`);
    } catch (error) {
      warn(`${serial}: failed to install ${entry.file} - ${error.message}`);
    }
  }
}

function main() {
  if (process.env.SKIP_TEST_BROWSERS === '1') {
    info('SKIP_TEST_BROWSERS=1 - skipping test browser sync');
    return;
  }
  if (!existsSync(apksDir)) {
    info('no apks/ directory - skipping test browser sync');
    info('download browsers from https://apkmirror.com and drop them in apks/');
    return;
  }

  const catalog = scanCatalog();
  const manifest = readManifest();
  const now = new Date().toISOString();
  manifest.catalog = catalog;

  if (catalog.length === 0) {
    info('apks/ has no APKs - download some from https://apkmirror.com and drop them in');
  } else {
    info(`apks/ catalog: ${catalog.map((entry) => entry.package ?? entry.file).join(', ')}`);
  }

  const adb = findAdb();
  if (!adb) {
    warn('adb not found (set ANDROID_HOME) - catalog written, nothing installed');
    writeManifest(manifest, now);
    return;
  }

  let devices = [];
  try {
    devices = attachedDevices(adb);
  } catch (error) {
    warn(`could not list devices: ${error.message}`);
    writeManifest(manifest, now);
    return;
  }
  if (devices.length === 0) {
    warn('no Android device or emulator attached - catalog written, nothing installed');
    warn('start the emulator, then run `npm run android:browsers` to sync it');
    writeManifest(manifest, now);
    return;
  }

  for (const serial of devices) {
    const device = manifest.devices[serial] ?? { files: {} };
    const records = device.files ?? {};
    let plan;
    try {
      plan = reconcile({ catalog, recorded: records, installed: installedPackages(adb, serial), force });
    } catch (error) {
      warn(`${serial}: could not read installed packages - ${error.message}`);
      continue;
    }
    if (plan.install.length === 0 && plan.uninstall.length === 0) {
      info(`${serial}: in sync with apks/`);
    }
    applyPlan(adb, serial, plan, records, now);
    manifest.devices[serial] = { ...device, files: records, syncedAt: now };
  }

  writeManifest(manifest, now);
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    warn(`unexpected failure, continuing anyway - ${error.message}`);
  }
}
