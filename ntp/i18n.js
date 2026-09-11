/** Boxing — NTP i18n store: messages.json loader, en fallback dictionary, DOM applier.
 *
 * Ticket 04 (architecture-recovery): extracted verbatim from ntp.js (i18n block, markers
 * '── i18n store' → '── DOM refs'; uniform -2 indent from the IIFE origin, round-trip
 * verified in the extraction script) — second module of the zero-build strangler-fig
 * pipeline (spec.md wave 1). The dictionary (I18N_FALLBACK) lives in the same module as
 * the store — callgraph-report §5 #3 guards against fallback/dictionary drift. Duplicate
 * keys inside I18N_FALLBACK (dblclickCreateHint etc.) are pre-existing debt, moved as-is
 * (later key wins — do not "clean" without re-checking rendered strings).
 *
 * Host deps injected once by ntp.js via initI18n() — SEC-01 keeps the file:// mock local
 * to ntp.js, so the module only receives the resolved handle:
 *   __api      cross-browser api (mock-resolved) — runtime.getURL for the _locales fetch
 *   __debug    [Boxing] DEBUG logger (BX-AUD-05 tiered log system)
 *   __debugErr [Boxing][ERR] logger
 *
 * Exports: initI18n, loadI18nStore, i18n, applyI18n + live bindings currentLang /
 * SUPPORTED_LANGS. i18nStore / I18N_FALLBACK are module-private (0 external refs pre-split).
 */
let __api = null;
let __debug = () => {};
let __debugErr = () => {};

export function initI18n(deps) {
  if (!deps) return;
  if (deps.api) __api = deps.api;
  if (typeof deps.debug === 'function') __debug = deps.debug;
  if (typeof deps.debugErr === 'function') __debugErr = deps.debugErr;
}

// ── i18n store ─────────────────────────────────────────
let i18nStore = {};
const I18N_FALLBACK = {
  brandName: 'Boxing', brandSub: 'organize bookmarks hierarchically',
  searchPlaceholder: 'Search bookmarks…', settingsTitle: 'Settings',
  closeSettings: 'Close', settingsLanguage: 'Language / 语言',
  rememberLastPos: 'Remember last position', rememberLastPosHint: 'Automatically reopen last visited large box on new tabs',
  fontSizeLabel: 'Font Size', zoomLabel: 'Zoom',
  zoomOut: 'Zoom out', zoomIn: 'Zoom in',
  emptyCanvasTitle: 'No large boxes yet',
  emptyCanvasAction: 'Add large box',
  emptyLargeAction: 'Add small boxes',
  emptyInnerHint: 'Click + to add your first small box', emptySmallHint: 'No bookmarks yet',
  emptyInnerAction: 'Add small box',
  footerHint: 'Ctrl+scroll to zoom · Drag blank to pan · Double-click to create box · Right-click to go back · Drag titlebar to move · ⊙ top-right: unpin for fullscreen',
  canvasRoot: 'Canvas', untitledBox: 'Untitled box',
  untitledLargeBox: 'Untitled large box', untitledSmallBox: 'Untitled small box',
  newLargeBox: 'Box $1$', newSmallBox: 'New small box',
  deleteBox: 'Delete box', confirmDeleteLarge: 'Delete this large box and all its small boxes?',
  confirmDeleteSmall: 'Delete this small box?', pin: 'Pin', unpin: 'Unpin',
  largeBoxesCount: '$1$ large boxes', smallBoxesCount: '$1$ small boxes',
  backTooltip: 'Go back', addLargeBoxTooltip: 'Add large box',
  settingsTooltip: 'Open settings', addSmallBoxTooltip: 'Add small box',
  editBookmarkLabel: 'Edit bookmark', addBookmarkBtn: 'Add',
  addBookmarkPlaceholder: 'Paste URL…', bookmarkTitlePlaceholder: 'Bookmark title',
  bookmarkUrlPlaceholder: 'https://…',
  dblclickCreateHint: 'Double-click to create',
  bookmarkSave: 'Save', bookmarkDelete: 'Delete',
  bookmarkEditTitle: 'Edit Bookmark',
  backupNow: 'Backup Now', backupNowHint: 'Create a timestamped backup of all layout data',
  autoBackupInterval: 'Auto-Backup Interval', syncProvider: 'Sync Provider',
  syncProviderHint: 'Boxing stores data in browser sync storage. Choose your provider.',
  squareCorners: 'Square Corners', squareCornersHint: 'Use sharp square corners instead of rounded',
  smallBoxCountLabel: '$1$ small boxes',
  autoExpand: 'Auto expand', autoExpandHover: 'Hover to expand',
  headerPin: 'Pin header', headerPinOff: 'Unpin header',
  connDeleteActionLabel: 'Delete connection by', connDeleteActionHint: 'Choose how to delete a connection line between two boxes',
  connDeleteActionAltClick: 'Alt + Click', connDeleteActionCtrlClick: 'Ctrl + Click', connDeleteActionShiftClick: 'Shift + Click',
  connDeleteActionDoubleClick: 'Double-click', connDeleteActionSelectDelete: 'Click + Delete key'
  ,
  confirmDeleteTitle: 'Confirm Delete', confirmYes: 'Delete', confirmCancel: 'Cancel',
  confirmDeleteLargeBody: 'Delete this large box and all its small boxes? This action cannot be undone.',
  confirmDeleteSmallBody: 'Delete this small box and all its bookmarks? This action cannot be undone.',
 darkMode: 'Dark Mode', darkModeHint: 'Switch between light and dark appearance',
  themeColorLabel: 'Color Theme', themeColorHint: 'Select a color theme for the entire interface',
 exportData: 'Export Data', importData: 'Import Data',
  importSuccess: 'Data imported successfully', importFailed: 'Import failed: invalid data format',
  importTooLarge: 'Import failed: file too large (max 5MB)',
  dblclickCreateHint: 'Double-click to create',
  bookmarkSave: 'Save', bookmarkDelete: 'Delete',
  bookmarkEditTitle: 'Edit Bookmark',
  backupNow: 'Backup Now', backupNowHint: 'Create a timestamped backup of all layout data',
  autoBackupInterval: 'Auto-Backup Interval', syncProvider: 'Sync Provider',
  squareCorners: 'Square Corners', squareCornersHint: 'Use sharp square corners instead of rounded',
  // BX-DEV-111P-v2:补齐 en 字面 fallback 全覆盖 (fix-7)
  accessibilityLabel: 'Keyboard accessible · Screen reader friendly',
  addBoxShortcut: 'Double-click empty area',
  allLanguages: 'All 13 languages translated',
  backupSaved: 'Backup saved',
  bookmarkReorderHint: 'Drag the grip to reorder bookmarks',
  canvasBoundaryHint: 'Canvas has boundaries at 30% zoom level',
  ctrlScrollZoom: 'Ctrl+scroll to zoom',
  dblclickAddBox: 'Double-click to add box',
  debugModeOff: 'Debug: OFF',
  debugModeOn: 'Debug: ON',
  deleteConfirmMessage: 'This action cannot be undone. All bookmarks inside will be removed.',
  diagClearLog: 'Clear Log',
  diagExportLog: 'Export Log',
  diagLogLevelDebug: 'Debug',
  diagLogLevelError: 'Error',
  diagLogLevelInfo: 'Info',
  diagLogLevelLabel: 'Log level',
  diagLogLevelWarn: 'Warning',
  diagNoLogs: 'No log entries yet',
  diagSectionDesc: 'Export a small ring-buffer snapshot of recent Boxing events to help diagnose issues. The buffer holds up to 300 entries and never persists across browser restarts.',
  diagSectionTitle: 'Diagnostics',
  doubleClickToCreateHint: 'Double-click to create',
  dragPanCanvas: 'Drag to pan canvas',
  dragToReorder: 'Drag to reorder',
  emptyBoxDragHint: 'Double-click or click + to add a box',
  emptyCanvasHint: 'Click + to create your first large box',
  escReturnHint: 'Press Esc to return to canvas',
  fontSizeLarge: 'Large',
  fontSizeNormal: 'Normal',
  fontSizeSmall: 'Small',
  headerPinUsage: 'Click ⊙ in canvas top-right: pinned keeps top bar visible, unpinned goes fullscreen',
  langAutoDetect: 'Auto-detect (browser language)',
  lastOpenedBox: 'Last opened box',
  noBookmarksYet: 'No bookmarks yet. Click + to add one.',
  onboardingSkipTour: 'Skip',
onboardingLangDesc: 'Pick a language for the interface',
  onboardingLangTitle: 'Choose your language',
  onboardingRestore: 'Restore from backup',
  panShortcut: 'Left-drag empty area',
  returnShortcut: 'Right-click or Esc to return',
  rightClickReturnHint: 'Right-click to go back to canvas',
  searchResults: '$1$ results',
  searchShortcut: '/ or Ctrl+F',
  searchSlash: '/ to search',
  settingsCategoryAppearance: 'Appearance',
  settingsCategoryData: 'Data',
  settingsCategoryGeneral: 'General',
  settingsCategorySync: 'Sync & Backup',
  startDragHint: 'Drag titlebar to move box',
  storedDataFound: 'Stored data found',
  undoShortcut: 'Ctrl+Z to undo',
  urlOpenModeCurrentTab: 'Current Tab',
  urlOpenModeHint: 'Choose where bookmarks open when clicked',
  urlOpenModeLabel: 'Open bookmarks in',
  urlOpenModeNewTab: 'New Tab',
  webdavErrBlockedHost: 'WebDAV hosts on private or local network addresses are not allowed',
  webdavErrUrlTooLong: 'WebDAV URL is too long',
  zoomShortcut: 'Ctrl+scroll wheel',
  // Ticket 43 (spec D3): settings data-health surface — snapshot count / latest snapshot
  // time / corrupt-archive entry (kept in sync with all 14 _locales messages.json).
  dataHealthTitle: 'Data health',
  dataSnapshotCount: 'Snapshot count',
  dataLastSnapshotTime: 'Latest snapshot',
  dataCorruptArchived: 'Corrupted layout archived',
  dataHealthHint: 'Boxing keeps time-layered snapshots of your layout. If the main storage is ever damaged, it is archived (never silently overwritten) and rebuilt from the latest healthy snapshot.',
};
// Add new v3.6 keys to I18N_FALLBACK
I18N_FALLBACK.syncLocalOnly = 'Local Only';
I18N_FALLBACK.syncChrome = 'Chrome Sync';
I18N_FALLBACK.syncFirefox = 'Firefox Sync';
I18N_FALLBACK.backupDisabled = 'Disabled';
I18N_FALLBACK.backupDaily = 'Daily';
I18N_FALLBACK.backupWeekly = 'Weekly';
I18N_FALLBACK.backupHourly = 'Hourly';
I18N_FALLBACK.syncWebDAV = 'WebDAV';
I18N_FALLBACK.syncGitHubGist = 'GitHub Gist';
I18N_FALLBACK.syncGroupShared = 'Shared settings';
I18N_FALLBACK.webdavUrl = 'WebDAV URL';
I18N_FALLBACK.webdavUser = 'Username';
I18N_FALLBACK.webdavPass = 'Password';
I18N_FALLBACK.gistToken = 'GitHub Token';
I18N_FALLBACK.gistTokenHint = 'Create a personal access token with gist scope';
I18N_FALLBACK.gistId = 'Gist ID (auto-filled)';
I18N_FALLBACK.webdavTestBtn = 'Test Connection';
I18N_FALLBACK.webdavTestOk = 'WebDAV connection OK';
I18N_FALLBACK.webdavTestFail = 'WebDAV connection failed';
I18N_FALLBACK.webdavTesting = 'Testing...';
I18N_FALLBACK.webdavErrNoUrl = 'WebDAV URL not configured';
I18N_FALLBACK.webdavErrHttps = 'WebDAV URL must use HTTPS';
I18N_FALLBACK.webdavErrEmbedded = 'WebDAV URL must not contain embedded credentials';
I18N_FALLBACK.webdavErrNoPass = 'WebDAV password is empty — re-enter and retry';
I18N_FALLBACK.webdavErrAuth = 'WebDAV auth failed ($1$) — check credentials';
I18N_FALLBACK.webdavErrPath = 'WebDAV path not found — check the URL';
I18N_FALLBACK.webdavErrStatus = 'WebDAV server returned $1$';
I18N_FALLBACK.webdavErrPut = 'WebDAV PUT failed ($1$)';
I18N_FALLBACK.webdavErrConflict = 'WebDAV conflict — parent directory may not exist';
I18N_FALLBACK.webdavErrNetwork = 'Cannot reach WebDAV server — check URL or network';
I18N_FALLBACK.gistBackupOk = 'Gist backup saved';
I18N_FALLBACK.gistBackupFail = 'Gist backup failed';
I18N_FALLBACK.backupTooFrequent = 'Auto-backup skipped: too frequent, minimum interval 1 hour';
I18N_FALLBACK.lastBackupTime = 'Last backup';
I18N_FALLBACK.neverText = 'Never';
I18N_FALLBACK.settingsNavGeneral = 'General';
I18N_FALLBACK.settingsNavAppearance = 'Appearance';
I18N_FALLBACK.settingsNavData = 'Data';
I18N_FALLBACK.settingsNavSync = 'Sync & Backup';
I18N_FALLBACK.lastPositionLabel = 'Last position';
I18N_FALLBACK.lastZoomLabel = 'Last zoom';
I18N_FALLBACK.lastPageLabel = 'Last page';
I18N_FALLBACK.boxDeletedWarning = 'This box has been deleted. Please refresh the page.';
I18N_FALLBACK.refreshPage = 'Refresh';
I18N_FALLBACK.themeBeige = 'Beige';
I18N_FALLBACK.themeGraphite = 'Graphite';
I18N_FALLBACK.themeCoastal = 'Coastal';
I18N_FALLBACK.themeForest = 'Forest';
I18N_FALLBACK.themePure = 'Pure White';

// BX-DEV-SYNC: WebDAV sync i18n keys
I18N_FALLBACK.syncNow = 'Sync Now';
I18N_FALLBACK.syncInProgress = 'Syncing...';
I18N_FALLBACK.syncOk = 'Sync completed';
I18N_FALLBACK.syncPullFirstTime = 'Cloud data detected — pulling to this device (first sync)';
I18N_FALLBACK.syncUploadNewer = 'Local data is newer — uploaded to cloud';
I18N_FALLBACK.syncCloudNewer = 'Cloud data is newer — updated local from cloud';
I18N_FALLBACK.syncErrPartialLoss = 'Possible data loss detected ($1$ → $2$ boxes). Abort and restore from cloud?';
I18N_FALLBACK.syncErrPartialLossTitle = 'Data loss detected';
I18N_FALLBACK.syncErrCloudRestored = 'Local data restored from cloud ($1$ boxes)';
I18N_FALLBACK.syncErrCloudRestoreFailed = 'Cloud restore failed: $1$';
I18N_FALLBACK.syncErrGetFailed = 'WebDAV GET failed ($1$)';
I18N_FALLBACK.syncErrParseFailed = 'Cloud data is not valid JSON';
I18N_FALLBACK.onboardingTitle = 'Welcome to Boxing';
I18N_FALLBACK.onboardingSkipTour = 'Skip';
I18N_FALLBACK.onboardingPrev = 'Previous';
I18N_FALLBACK.onboardingNext = 'Next';
I18N_FALLBACK.onboardingFinish = 'Get started';
I18N_FALLBACK.onboardingStep1Label = 'Step 1 of 3';
I18N_FALLBACK.onboardingStep1Title = 'Add your first box';
I18N_FALLBACK.onboardingStep1Desc = 'Double-click anywhere on the canvas, or click the + button in the toolbar, to create a large box. Large boxes group related small boxes and bookmarks.';
I18N_FALLBACK.onboardingStep2Label = 'Step 2 of 3';
I18N_FALLBACK.onboardingStep2Title = 'Nest boxes inside';
I18N_FALLBACK.onboardingStep2Desc = 'Open a large box, then click + to add small boxes inside it. Each small box holds a list of bookmarks and can be reordered by drag.';
I18N_FALLBACK.onboardingStep3Label = 'Step 3 of 3';
I18N_FALLBACK.onboardingStep3Title = 'Sync across devices';
I18N_FALLBACK.onboardingStep3Desc = 'Open Settings → Sync to connect a WebDAV server. Your boxes sync across browsers and tabs; data is backed up safely with timestamp-based two-way sync.';
// Ticket 44 (spec D4): import/restore merge + conflict-copy UI strings (BX-I18N-005 fallback).
I18N_FALLBACK.importMergeTitle = 'Restore from backup';
I18N_FALLBACK.importMergeBody = 'Merge import: $1$ new box(es), $2$ same-id conflict(s) archived as conflict copies, $3$ identical box(es) skipped. Nothing on your canvas is overwritten.';
I18N_FALLBACK.importOverwriteTitle = 'Overwrite restore';
I18N_FALLBACK.importOverwriteBody = 'Overwrite replaces your entire canvas with the backup. Your current data is snapshotted first, so it can be recovered afterwards. Continue with overwrite?';
I18N_FALLBACK.importBtnMerge = 'Merge & import';
I18N_FALLBACK.importBtnOverwrite = 'Overwrite restore';
I18N_FALLBACK.dataConflictArchived = 'Conflict copies archived';
// Ticket 50 (spec W6-D1): Time Machine rollback UI + pre-restore safety snapshot (BX-I18N-005)
I18N_FALLBACK.dataTimeMachine = 'Time Machine';
I18N_FALLBACK.dataRollbackBtn = 'Roll back';
I18N_FALLBACK.rollbackConfirmTitle = 'Roll back to this snapshot?';
I18N_FALLBACK.rollbackConfirmBody = 'The canvas will be replaced with the snapshot from $1$. Your current data is saved as a safety snapshot first, so this rollback can itself be undone.';
I18N_FALLBACK.rollbackConfirmAction = 'Roll back now';
I18N_FALLBACK.rollbackNoSafety = 'A safety snapshot of your current data could not be saved, so the rollback was cancelled. Nothing was changed.';
I18N_FALLBACK.rollbackSnapshotMissing = 'That snapshot is no longer available. Nothing was changed.';
I18N_FALLBACK.rollbackFailed = 'Rollback failed - your current data was kept unchanged.';
// Ticket 51 (spec W6-D2): export envelope + optional full DR package UI strings (BX-I18N-005 fallback).
I18N_FALLBACK.exportFullPackage = 'Full DR package';
I18N_FALLBACK.exportFullOverflow = 'The full DR package still exceeds the 5MB restore limit after trimming snapshot bodies. A standard envelope export was downloaded instead.';
export let currentLang = 'en';
// BX-i18n-LOC: To add a new language, append the code here + update ONB_LANG_LABELS below + create _locales/<code>/messages.json.
export const SUPPORTED_LANGS = ['en', 'zh_CN', 'ja', 'ko', 'fr', 'de', 'es', 'pt_BR', 'ru', 'ar', 'hi', 'th', 'vi', 'zh_TW'];

async function loadI18nStore(lang) {
  try {
    const url = __api.runtime?.getURL?.(`_locales/${lang}/messages.json`) || `_locales/${lang}/messages.json`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const raw = await resp.json();
    i18nStore = {};
    for (const [k, v] of Object.entries(raw)) {
      i18nStore[k] = (typeof v === 'object' && v.message) ? { message: v.message, placeholders: (v.placeholders || null) } : v;
    }
    currentLang = lang;
    __debug(`i18n loaded: ${lang}, ${Object.keys(i18nStore).length} keys`);
  } catch (e) {
    __debugErr('i18n load failed, falling back to en', e);
    i18nStore = { ...I18N_FALLBACK };
    currentLang = 'en';
  }
  applyI18n();
}

function i18n(key, placeholders) {
  const entry = i18nStore[key];
  let msg, phMap = null;
  if (entry && typeof entry === 'object' && entry.message) {
    msg = entry.message;
    phMap = entry.placeholders || null;
  } else if (typeof entry === 'string') {
    msg = entry;
  } else {
    msg = I18N_FALLBACK[key] || key;
  }
  if (placeholders && Array.isArray(placeholders) && placeholders.length) {
    if (phMap && Object.keys(phMap).length) {
      for (const [name, info] of Object.entries(phMap)) {
        let content = String((info && info.content) || '');
        for (let i = 0; i < placeholders.length; i++) {
          content = content.split('$' + (i + 1)).join(String(placeholders[i]));
        }
        msg = msg.split('$' + name + '$').join(content);
      }
    } else {
      for (let i = 0; i < placeholders.length; i++) { msg = msg.split('$' + (i + 1) + '$').join(String(placeholders[i])); }
    }
  }
  return msg;
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = i18n(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = i18n(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = i18n(el.dataset.i18nPlaceholder);
  });
}

export { loadI18nStore, i18n, applyI18n };
