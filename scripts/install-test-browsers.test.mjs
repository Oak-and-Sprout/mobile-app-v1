import { describe, expect, it } from 'vitest';
import { densityBucketFor, packageNameFromFile, splitsForDevice } from './install-test-browsers.mjs';

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

  it('returns null when the name is not a package id, so we install instead of guessing', () => {
    expect(packageNameFromFile('some-browser.apk')).toBeNull();
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
