export function createImportExportController({ getData, setData, save, render }) {
  function bind() {
    document.getElementById('exportBtn').addEventListener('click', async () => {
      const backup = { schemaVersion: 2, exportedAt: new Date().toISOString(), app: 'Chrona', entries: getData() };
      const jsonStr = JSON.stringify(backup, null, 2);
      const filename = 'chrona-backup_' + new Date().toISOString().slice(0, 10) + '.json';
      const blob = new Blob([jsonStr], { type: 'application/json' });

      try {
        if (
          navigator.canShare &&
          navigator.canShare({ files: [new File([blob], filename, { type: 'application/json' })] })
        ) {
          await navigator.share({
            files: [new File([blob], filename, { type: 'application/json' })],
            title: 'Chrona Backup',
            text: 'Here is your timesheet backup file.',
          });
          return;
        }
      } catch (err) {
        console.log('Share canceled or failed', err);
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    });

    document.getElementById('importBtn').addEventListener('click', () => {
      document.getElementById('importFile').click();
    });
    document.getElementById('importFile').addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        try {
          const parsed = JSON.parse(loadEvent.target.result);
          const imported = parsed && parsed.entries ? parsed.entries : parsed; // accepts legacy v1 backups
          if (!imported || typeof imported !== 'object' || Array.isArray(imported)) throw new Error('Invalid backup');
          const clean = {};
          Object.entries(imported).forEach(([key, entry]) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !entry || !['present', 'leave', 'holiday'].includes(entry.status))
              return;
            clean[key] = {
              status: entry.status,
              hours: Number.isFinite(Number(entry.hours)) ? Number(entry.hours) : 0,
            };
            if (typeof entry.note === 'string' && entry.note.trim()) clean[key].note = entry.note.trim().slice(0, 500);
          });
          if (!Object.keys(clean).length && Object.keys(imported).length) throw new Error('No valid entries');
          setData(Object.assign({}, getData(), clean));
          save();
          render();
        } catch {
          alert('Could not read that file. Make sure it is a timesheet backup exported from this tool.');
        }
      };
      reader.readAsText(file);
      event.target.value = '';
    });
  }

  return { bind };
}
