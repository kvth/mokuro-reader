<script lang="ts">
  import { AccordionItem, Button, Helper } from 'flowbite-svelte';
  import { showSnackbar } from '$lib/util';
  import { exportDataBackup, importDataBackup } from '$lib/util/data-backup';

  let files = $state<FileList>();
  let busy = $state(false);

  async function onExport() {
    busy = true;
    try {
      const blob = exportDataBackup();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `mokuro-reader-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      showSnackbar('Data exported');
    } catch (error) {
      console.error('Data export failed:', error);
      showSnackbar('Export failed');
    } finally {
      busy = false;
    }
  }

  async function onImport() {
    const file = files?.[0];
    if (!file) return;
    busy = true;
    try {
      await importDataBackup(file);
      showSnackbar('Data imported');
    } catch (error) {
      console.error('Data import failed:', error);
      showSnackbar(error instanceof Error ? `Import failed: ${error.message}` : 'Import failed');
    } finally {
      busy = false;
    }
  }
</script>

<AccordionItem>
  {#snippet header()}Data backup{/snippet}
  <div class="flex flex-col gap-2">
    <Helper>
      Reading progress, stats, series reading state and settings profiles. Importing merges with
      what is here and keeps the newest entry, so older backups never overwrite newer progress.
      Manga volumes are not included.
    </Helper>
    <Button onclick={onExport} disabled={busy} size="sm" color="light">Export all data</Button>
    <input
      class="rounded-lg border border-gray-700 text-gray-900 file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-gray-700 hover:file:bg-gray-200 dark:text-white dark:file:bg-gray-700 dark:file:text-gray-200 dark:hover:file:bg-gray-600"
      type="file"
      accept=".json"
      bind:files
    />
    <Button onclick={onImport} disabled={!files?.length || busy} size="sm" outline color="blue"
      >Import all data</Button
    >
  </div>
</AccordionItem>
