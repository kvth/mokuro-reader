/**
 * Data backup: one JSON file holding the same `volume-data.json` (read
 * progress, stats and series reading state) and `profiles.json` (settings
 * profiles) contents that cloud sync writes. Importing merges them newest-wins
 * exactly like a sync, so restoring an old backup never overwrites newer
 * progress.
 *
 * Manga volumes are not included; they are exported as CBZ/ZIP from the series
 * page instead.
 */
import { get } from 'svelte/store';
import { unifiedSyncService } from './sync/unified-sync-service';

const BACKUP_FORMAT = 'mokuro-reader-backup';
const BACKUP_VERSION = 1;

interface DataBackup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  volumeData?: Record<string, unknown>;
  profiles?: Record<string, unknown>;
}

export function exportDataBackup(): Blob {
  const { volumeData, profiles } = unifiedSyncService.getLocalSyncFiles();
  const backup: DataBackup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    volumeData,
    profiles
  };
  return new Blob([JSON.stringify(backup)], { type: 'application/json' });
}

/** Merge a backup file into local state. */
export async function importDataBackup(file: Blob): Promise<void> {
  if (get(unifiedSyncService.isSyncing)) {
    throw new Error('A cloud sync is running, try again when it has finished');
  }

  let backup: Partial<DataBackup>;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    throw new Error('Not a valid backup file');
  }
  if (backup?.format !== BACKUP_FORMAT) {
    throw new Error('Not a Mokuro Reader backup file');
  }
  if ((backup.version ?? 0) > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of the reader');
  }

  unifiedSyncService.mergeSyncFiles({
    volumeData: backup.volumeData,
    profiles: backup.profiles
  });
}
