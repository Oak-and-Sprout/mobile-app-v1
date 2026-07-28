import { describe, expect, it } from 'vitest';
import {
  densityBucketFor,
  isBundle,
  packageNameFromFile,
  reconcile,
  splitsForDevice,
} from './install-test-browsers.mjs';

// The entry list of the real apkmirror bundle in apks/ (unzip -Z -1), trimmed
// to the .apk members the installer cares about.
const WATERFOX_ENTRIES = [
  'base.apk',
  'split_config.xxxhdpi.apk',
  'split_config.arm64_v8a.apk',
  'split_config.tvdpi.apk',
  'split_config.ldpi.apk',
  'split_config.mdpi.apk',
  'split_config.hdpi.apk',
  'split_config.armeabi_v7a.apk',
  'split_config.xhdpi.apk',
  'split_config.x86_64.apk',
  'split_config.xxhdpi.apk',
];

const firefox = {
  file: 'org.mozilla.firefox_153.0_apkmirror.com.apk',
  package: 'org.mozilla.firefox',
  format: 'apk',
  size: 624413566,
  mtime: 1000,
};
const waterfox = {
  file: 'net.waterfox.android.release_1.2.6_apkmirror.com.apkm',
  package: 'net.waterfox.android.release',
  format: 'bundle',
  size: 277721754,
  mtime: 2000,
};
const recordFor = (entry, overrides = {}) => ({
  package: entry.package,
  size: entry.size,
  mtime: entry.mtime,
  managed: true,
  ...overrides,
});

describe('packageNameFromFile', () => {
  it('reads the package id off apkmirror filenames', () => {
    expect(
      packageNameFromFile(
        'org.mozilla.firefox_153.0-2016172927_minAPI26(arm64-v8a,armeabi-v7a,x86_64)(nodpi)_apkmirror.com.apk',
      ),
    ).toBe('org.mozilla.firefox');
    expect(
      packageNameFromFile('net.waterfox.android.release_1.2.6-2026288468_3arch_7dpi_x_apkmirror.com.apkm'),
    ).toBe('net.waterfox.android.release');
  });

  it('reads the name out of a nested path, not the directory above it', () => {
    expect(packageNameFromFile('browsers/org.mozilla.firefox_153.0_x.apk')).toBe('org.mozilla.firefox');
  });

  it('returns null when the name is not a package id, so we install instead of guessing', () => {
    expect(packageNameFromFile('some-browser.apk')).toBeNull();
  });
});

describe('isBundle', () => {
  it('recognises split archives and plain apks', () => {
    expect(isBundle('x.apkm')).toBe(true);
    expect(isBundle('x.XAPK')).toBe(true);
    expect(isBundle('x.apk')).toBe(false);
  });
});

describe('densityBucketFor', () => {
  it('maps an exact bucket density to its own bucket', () => {
    expect(densityBucketFor(480)).toBe('xxhdpi');
  });

  it('rounds an in-between density up, the way Android picks assets', () => {
    expect(densityBucketFor(440)).toBe('xxhdpi');
  });

  it('falls back to xxhdpi when the density is unreadable', () => {
    expect(densityBucketFor(0)).toBe('xxhdpi');
  });
});

describe('splitsForDevice', () => {
  it('takes base plus exactly one abi and one density split', () => {
    const selection = splitsForDevice(WATERFOX_ENTRIES, ['arm64-v8a', 'armeabi-v7a'], 'xxhdpi');
    expect(selection.paths).toEqual([
      'base.apk',
      'split_config.arm64_v8a.apk',
      'split_config.xxhdpi.apk',
    ]);
  });

  it('honours abi preference order, so an x86_64 emulator gets the x86_64 split', () => {
    const selection = splitsForDevice(WATERFOX_ENTRIES, ['x86_64', 'arm64-v8a'], 'xhdpi');
    expect(selection.abiSplit).toBe('split_config.x86_64.apk');
    expect(selection.densitySplit).toBe('split_config.xhdpi.apk');
  });

  it('keeps non-config members (language packs, feature modules) but drops other configs', () => {
    const selection = splitsForDevice(
      [...WATERFOX_ENTRIES, 'split_feature_pdf.apk'],
      ['arm64-v8a'],
      'hdpi',
    );
    expect(selection.paths).toContain('split_feature_pdf.apk');
    expect(selection.paths).not.toContain('split_config.x86_64.apk');
  });

  it('reports a missing abi split rather than silently installing base alone', () => {
    const selection = splitsForDevice(WATERFOX_ENTRIES, ['riscv64'], 'hdpi');
    expect(selection.abiSplit).toBeUndefined();
    expect(selection.paths).toEqual(['base.apk', 'split_config.hdpi.apk']);
  });

  it('returns null when there is no base.apk to build on', () => {
    expect(splitsForDevice(['split_config.hdpi.apk'], ['arm64-v8a'], 'hdpi')).toBeNull();
  });
});

describe('reconcile', () => {
  it('installs an apk the device has never seen', () => {
    const plan = reconcile({ catalog: [firefox], installed: new Set() });
    expect(plan.install).toEqual([{ entry: firefox, reason: 'new' }]);
    expect(plan.uninstall).toEqual([]);
  });

  it('leaves an unchanged, already-installed apk alone', () => {
    const plan = reconcile({
      catalog: [firefox],
      recorded: { [firefox.file]: recordFor(firefox) },
      installed: new Set([firefox.package]),
    });
    expect(plan.install).toEqual([]);
    expect(plan.uninstall).toEqual([]);
    expect(plan.skip[0].reason).toBe('already installed');
    expect(plan.skip[0].adopt).toBe(false);
  });

  it('adopts a package that is already on the device but has an apk in the folder', () => {
    const plan = reconcile({ catalog: [firefox], installed: new Set([firefox.package]) });
    expect(plan.install).toEqual([]);
    expect(plan.skip[0]).toMatchObject({ reason: 'already installed', adopt: true });
  });

  it('reinstalls when the file on disk changed - a newer download of the same package', () => {
    const plan = reconcile({
      catalog: [{ ...firefox, size: firefox.size + 1, mtime: 9999 }],
      recorded: { [firefox.file]: recordFor(firefox) },
      installed: new Set([firefox.package]),
    });
    expect(plan.install[0].reason).toBe('file changed');
  });

  it('reinstalls when the package was removed from the device behind our back', () => {
    const plan = reconcile({
      catalog: [firefox],
      recorded: { [firefox.file]: recordFor(firefox) },
      installed: new Set(),
    });
    expect(plan.install[0].reason).toBe('removed from device');
  });

  it('uninstalls a package whose apk was deleted from the folder', () => {
    const plan = reconcile({
      catalog: [firefox],
      recorded: { [firefox.file]: recordFor(firefox), [waterfox.file]: recordFor(waterfox) },
      installed: new Set([firefox.package, waterfox.package]),
    });
    expect(plan.uninstall).toEqual([
      { file: waterfox.file, package: waterfox.package, reason: 'removed from apks/' },
    ]);
  });

  it('treats a file moved into a subfolder as a move, not a removal', () => {
    const moved = { ...waterfox, file: `browsers/${waterfox.file}` };
    const plan = reconcile({
      catalog: [moved],
      recorded: { [waterfox.file]: recordFor(waterfox) },
      installed: new Set([waterfox.package]),
    });
    expect(plan.uninstall).toEqual([]);
    expect(plan.install).toEqual([]);
    const move = plan.skip.find((item) => item.reason === 'moved within apks/');
    // Pruned so the stale path stops being reported on every later run.
    expect(move).toMatchObject({ prune: true, entry: { file: waterfox.file } });
  });

  it('never uninstalls a package we did not install ourselves', () => {
    const plan = reconcile({
      catalog: [],
      recorded: { [waterfox.file]: recordFor(waterfox, { managed: false }) },
      installed: new Set([waterfox.package]),
    });
    expect(plan.uninstall).toEqual([]);
    expect(plan.skip[0].reason).toBe('gone from apks/, not ours to remove');
  });

  it('does not try to uninstall something already off the device', () => {
    const plan = reconcile({
      catalog: [],
      recorded: { [waterfox.file]: recordFor(waterfox) },
      installed: new Set(),
    });
    expect(plan.uninstall).toEqual([]);
    expect(plan.skip[0].reason).toBe('gone from apks/, already off device');
  });

  it('reinstalls everything under force, without inventing uninstalls', () => {
    const plan = reconcile({
      catalog: [firefox, waterfox],
      recorded: { [firefox.file]: recordFor(firefox), [waterfox.file]: recordFor(waterfox) },
      installed: new Set([firefox.package, waterfox.package]),
      force: true,
    });
    expect(plan.install.map((item) => item.reason)).toEqual(['forced', 'forced']);
    expect(plan.uninstall).toEqual([]);
  });

  it('installs an apk whose package id could not be resolved, since we cannot check it', () => {
    const mystery = { file: 'mystery-browser.apk', package: null, format: 'apk', size: 1, mtime: 1 };
    const plan = reconcile({ catalog: [mystery], installed: new Set() });
    expect(plan.install[0].reason).toBe('package id unknown');
  });
});
