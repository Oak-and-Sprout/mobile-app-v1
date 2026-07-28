#!/usr/bin/env node
/**
 * Installs the browser APKs sitting in `apks/` onto every attached Android
 * target, so the emulator has the browsers we test hand-off against - notably
 * the `/account` path, which the shell deliberately does NOT claim as a deep
 * link (App Store compliance keeps subscription management in the system
 * browser).
 *
 * Installing does not make one of them the default; Chrome keeps the BROWSER
 * role on a Play-services image. To point hand-off at one of these instead:
 *   adb shell cmd role add-role-holder android.app.role.BROWSER org.mozilla.firefox
 *
 * `apks/` is gitignored - the files are hundreds of MB and come from
 * apkmirror.com - so everything here degrades to a warning when the directory,
 * the SDK, or a device is missing. `npm run android` must never fail because a
 * convenience browser could not be installed.
 *
 * Two payload shapes are supported:
 *   - `.apk`  - a universal APK, installed directly.
 *   - `.apkm` / `.apks` / `.xapk` - an APKMirror/bundletool split archive. Only
 *     base.apk plus the splits matching the device's ABI and screen density are
 *     extracted; installing every split at once conflicts.
 *
 * Package names are read from the apkmirror filename convention
 * (`<package>_<version>...`), which avoids needing aapt/bundletool locally.
 * Already-installed packages are skipped unless REINSTALL_TEST_BROWSERS=1.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apksDir = join(repoRoot, 'apks');
const BUNDLE_EXTENSIONS = ['.apkm', '.apks', '.xapk'];
const force = process.env.REINSTALL_TEST_BROWSERS === '1';

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

/** apkmirror names files `<package>_<version>_<...>.apk`. */
export function packageNameFromFile(fileName) {
  const head = fileName.split('_')[0];
  return /^[A-Za-z][\w]*(\.[\w]+)+$/.test(head) ? head : null;
}

function isInstalled(adb, serial, pkg) {
  const out = adbOut(adb, ['-s', serial, 'shell', 'pm', 'list', 'packages', pkg]);
  return out
    .split('\n')
    .some((line) => line.trim() === `package:${pkg}`);
}

function deviceAbis(adb, serial) {
  const list = adbOut(adb, ['-s', serial, 'shell', 'getprop', 'ro.product.cpu.abilist']).trim();
  if (list) return list.split(',').map((abi) => abi.trim()).filter(Boolean);
  const single = adbOut(adb, ['-s', serial, 'shell', 'getprop', 'ro.product.cpu.abi']).trim();
  return single ? [single] : [];
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

  const abiSplit = abis
    .map((abi) => configName(abi.replace(/-/g, '_')))
    .find(Boolean);
  const densitySplit = configName(densityBucket);

  const chosen = [base, abiSplit, densitySplit].filter(Boolean);
  // Anything left that isn't a config split (language packs, feature modules)
  // is architecture-neutral and safe to bring along.
  const extras = entries.filter(
    (entry) => !chosen.includes(entry) && !/config\.[\w]+\.apk$/.test(entry.replace(/-/g, '_')),
  );
  return { paths: [...chosen, ...extras], abiSplit, densitySplit };
}

function installUniversal(adb, serial, file) {
  execFileSync(adb, ['-s', serial, 'install', '-r', '-g', file], { stdio: 'inherit' });
}

function installBundle(adb, serial, file) {
  const entries = bundleEntries(file);
  const selection = splitsForDevice(entries, deviceAbis(adb, serial), deviceDensityBucket(adb, serial));
  if (!selection) {
    warn(`${file}: no base.apk inside the bundle, skipping`);
    return;
  }
  if (!selection.abiSplit) {
    warn(`${file}: no ABI split matches ${serial}, installing base only (it may not run)`);
  }
  const staging = mkdtempSync(join(tmpdir(), 'sprout-apkm-'));
  try {
    execFileSync('unzip', ['-o', '-q', '-j', file, ...selection.paths, '-d', staging], {
      stdio: 'inherit',
    });
    const staged = selection.paths.map((entry) => join(staging, entry.split('/').pop()));
    execFileSync(adb, ['-s', serial, 'install-multiple', '-r', '-g', ...staged], { stdio: 'inherit' });
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

function main() {
  if (!existsSync(apksDir)) {
    info('no apks/ directory - skipping test browser install');
    return;
  }
  const files = readdirSync(apksDir)
    .filter((name) => name.endsWith('.apk') || BUNDLE_EXTENSIONS.some((ext) => name.endsWith(ext)))
    .sort();
  if (files.length === 0) {
    info('apks/ is empty - skipping test browser install');
    return;
  }

  const adb = findAdb();
  if (!adb) {
    warn('adb not found (set ANDROID_HOME) - skipping test browser install');
    return;
  }

  let devices;
  try {
    devices = attachedDevices(adb);
  } catch (error) {
    warn(`could not list devices: ${error.message}`);
    return;
  }
  if (devices.length === 0) {
    warn('no Android device or emulator attached - skipping test browser install');
    warn('start the emulator, then run `npm run android:browsers` to install them');
    return;
  }

  for (const serial of devices) {
    for (const name of files) {
      const file = join(apksDir, name);
      const pkg = packageNameFromFile(name);
      try {
        if (pkg && !force && isInstalled(adb, serial, pkg)) {
          info(`${serial}: ${pkg} already installed, skipping`);
          continue;
        }
        info(`${serial}: installing ${name}${pkg ? ` (${pkg})` : ''} - this is large, be patient`);
        if (BUNDLE_EXTENSIONS.some((ext) => name.endsWith(ext))) {
          installBundle(adb, serial, file);
        } else {
          installUniversal(adb, serial, file);
        }
        info(`${serial}: installed ${pkg ?? name}`);
      } catch (error) {
        warn(`${serial}: failed to install ${name} - ${error.message}`);
      }
    }
  }
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    warn(`unexpected failure, continuing anyway - ${error.message}`);
  }
}
