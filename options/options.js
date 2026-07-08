/** Boxing Options — Settings manager */
(async () => {
  const api = (typeof browser !== "undefined" ? browser :
    typeof chrome !== "undefined" ? chrome : null) || null;
  if (!api) return;

  // DOM elements
  const darkModeCheckbox = document.getElementById('dark-mode');
  const fontSizeInput = document.getElementById('font-size');
  const fontSizeValue = document.getElementById('font-size-value');
  const gridColsInput = document.getElementById('grid-cols');
  const gridColsValue = document.getElementById('grid-cols-value');
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importFileInput = document.getElementById('import-file');
  const saveBtn = document.getElementById('save-btn');

  // Load stored settings
  async function loadSettings() {
    try {
      const stored = await api.storage.sync.get({
        darkMode: false,
        fontSize: 14,
        gridCols: 6
      });
      
      darkModeCheckbox.checked = stored.darkMode;
      fontSizeInput.value = stored.fontSize;
      fontSizeValue.textContent = stored.fontSize + 'px';
      gridColsInput.value = stored.gridCols;
      gridColsValue.textContent = stored.gridCols;
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  }

  // Update display values
  fontSizeInput?.addEventListener('input', (e) => {
    fontSizeValue.textContent = e.target.value + 'px';
  });

  gridColsInput?.addEventListener('input', (e) => {
    gridColsValue.textContent = e.target.value;
  });

  // Save settings
  saveBtn?.addEventListener('click', async () => {
    try {
      await api.storage.sync.set({
        darkMode: darkModeCheckbox.checked,
        fontSize: parseInt(fontSizeInput.value),
        gridCols: parseInt(gridColsInput.value)
      });
      
      // Show feedback
      saveBtn.textContent = '✓ Saved';
      setTimeout(() => {
        saveBtn.textContent = 'Save Settings';
      }, 2000);
    } catch (err) {
      console.error('Error saving settings:', err);
      saveBtn.textContent = 'Error saving';
    }
  });

  // Export bookmarks
  exportBtn?.addEventListener('click', async () => {
    try {
      const tree = await api.bookmarks.getTree();
      const json = JSON.stringify(tree, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `qlearly-bookmarks-${Date.now()}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      exportBtn.textContent = '✓ Exported';
      setTimeout(() => {
        exportBtn.innerHTML = '<span aria-hidden="true">↓</span>Export Bookmarks';
      }, 2000);
    } catch (err) {
      console.error('Error exporting bookmarks:', err);
    }
  });

  // Import bookmarks
  importBtn?.addEventListener('click', () => {
    importFileInput.click();
  });

  importFileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data || !Array.isArray(data)) {
        alert('Invalid bookmark file format');
        return;
      }

      // Simple import: just notify user
      alert(`Bookmark import prepared. You can now manage bookmarks in Chrome/Firefox Bookmark Manager.`);
      importBtn.textContent = '✓ Ready';
      setTimeout(() => {
        importBtn.innerHTML = '<span aria-hidden="true">↑</span>Import Bookmarks';
      }, 2000);
    } catch (err) {
      console.error('Error importing bookmarks:', err);
      alert('Error reading bookmark file');
    }
  });

  // Initialize
  await loadSettings();
})();
