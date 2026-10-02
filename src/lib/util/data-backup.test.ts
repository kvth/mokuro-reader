import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writable } from 'svelte/store';

const isSyncing = writable(false);
const getLocalSyncFiles = vi.fn();
const mergeSyncFiles = vi.fn();

vi.mock('./sync/unified-sync-service', () => ({
  unifiedSyncService: {
    get isSyncing() {
      return isSyncing;
    },
    getLocalSyncFiles: () => getLocalSyncFiles(),
    mergeSyncFiles: (files: unknown) => mergeSyncFiles(files)
  }
}));

import { exportDataBackup, importDataBackup } from './data-backup';

const jsonFile = (data: unknown) => new Blob([JSON.stringify(data)]);

const volumeData = {
  'vol-1': { lastProgressUpdate: '2026-01-02T00:00:00Z', progress: 5 },
  series: { 'one piece': { read_count: 2, lastUpdated: '2026-08-20T00:00:00.000Z' } }
};
const profiles = { Default: { lastUpdated: '2026-08-20T00:00:00.000Z' } };

describe('data backup', () => {
  beforeEach(() => {
    isSyncing.set(false);
    getLocalSyncFiles.mockReset();
    mergeSyncFiles.mockReset();
  });

  it('round-trips the sync files through one JSON file', async () => {
    getLocalSyncFiles.mockReturnValue({ volumeData, profiles });

    const blob = exportDataBackup();
    expect(JSON.parse(await blob.text())).toMatchObject({
      format: 'mokuro-reader-backup',
      version: 1,
      volumeData,
      profiles
    });

    await importDataBackup(blob);
    expect(mergeSyncFiles).toHaveBeenCalledWith({ volumeData, profiles });
  });

  it('rejects files that are not a backup', async () => {
    await expect(importDataBackup(new Blob(['not json']))).rejects.toThrow(
      'Not a valid backup file'
    );
    await expect(importDataBackup(jsonFile({ Default: {} }))).rejects.toThrow(
      'Not a Mokuro Reader backup file'
    );
    expect(mergeSyncFiles).not.toHaveBeenCalled();
  });

  it('rejects a backup from a newer format version', async () => {
    await expect(
      importDataBackup(jsonFile({ format: 'mokuro-reader-backup', version: 2, profiles }))
    ).rejects.toThrow('newer version');
    expect(mergeSyncFiles).not.toHaveBeenCalled();
  });

  it('refuses to import while a cloud sync is running', async () => {
    isSyncing.set(true);

    await expect(
      importDataBackup(jsonFile({ format: 'mokuro-reader-backup', version: 1, profiles }))
    ).rejects.toThrow('cloud sync is running');
    expect(mergeSyncFiles).not.toHaveBeenCalled();
  });
});
