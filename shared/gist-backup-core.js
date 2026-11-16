// Boxing — shared Gist backup protocol core (tickets #126 / #128, spec #120 T7/T8).
//
// Pure decisions and payload/response shapes for Gist backups. No fetch, no
// storage, no DOM: the background service worker supplies the token/account/
// permission results and performs the request, and the same functions run in
// Node tests against controlled Gist API samples.
//
// Safety rules encoded here (spec D4/D5):
//   - An existing Gist is never treated as a newly creatable file.
//   - A saved Gist ID without a matching trusted baseline cannot be updated.
//   - A changed account, file name, or pending unknown result stops creation.
//   - Only a confirmed POST response with the expected file may become a baseline.
//   - Automatic updates of an existing Gist stay blocked: GitHub's official API
//     description declares no conditional write header for Gist PATCH, so there
//     is no verified primitive that stops a competing writer from being
//     overwritten (see docs/gist-conditional-write.md, #120 D4 release blocker).
//   - Manual writes are still allowed, but the background serialises every Gist
//     POST/PATCH in one queue so a manual click cannot race the unattended first
//     create. A pending POST result blocks both paths.
(function (root) {
  'use strict';

  const GIST_CREATE_DESCRIPTION = 'Boxing extension backup';
  const DEFAULT_GIST_FILE_NAME = 'boxing-backup.json';
  const GIST_ID_RE = /^[a-f0-9]{5,64}$/i;

  function normalizeGistId(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    return GIST_ID_RE.test(trimmed) ? trimmed.toLowerCase() : '';
  }

  // Mirrors the manual Gist path (ntp/sync-engine.js backupToGist): trim, turn
  // path separators into underscores, drop control characters, default if empty.
  // Never add a length limit here that the manual path does not have.
  function sanitizeGistFileName(raw) {
    const base = typeof raw === 'string' ? raw : '';
    const cleaned = base.trim().replace(/[\\/]/g, '_').replace(/[\x00-\x1f]/g, '');
    return cleaned || DEFAULT_GIST_FILE_NAME;
  }

  function buildGistCreateBody(fileName, content) {
    return {
      description: GIST_CREATE_DESCRIPTION,
      public: false,
      files: { [fileName]: { content } },
    };
  }

  function buildGistUpdateBody(fileName, content) {
    return { files: { [fileName]: { content } } };
  }

  function safeTimestamp(value) {
    const ts = Date.parse(value);
    return Number.isFinite(ts) && ts > 0 ? ts : 0;
  }

  function normalizeAccountId(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    return typeof value === 'string' && /^\d{1,20}$/.test(value) ? value : '';
  }

  // Returns a confirmed baseline shape only when the response carries the Gist id
  // AND the expected file. Anything else is an unknown result, never a success.
  function parseGistResponse(json, expectedFileName) {
    if (!json || typeof json !== 'object') return null;
    const gistId = normalizeGistId(json.id);
    if (!gistId) return null;
    const fileName = sanitizeGistFileName(expectedFileName);
    if (!json.files || typeof json.files !== 'object' || !json.files[fileName]) return null;
    const owner = json.owner && typeof json.owner === 'object' ? json.owner : {};
    const ownerId = normalizeAccountId(owner.id);
    const createdAt = safeTimestamp(json.created_at);
    const updatedAt = safeTimestamp(json.updated_at) || createdAt;
    return {
      gistId,
      fileName,
      ownerLogin: typeof owner.login === 'string' ? owner.login : '',
      ownerId,
      createdAt,
      updatedAt,
      fileSize: Number(json.files[fileName].size) || 0,
    };
  }

  // Returns the first gist that already carries the target file name, or null.
  // The caller pauses on any match: an untracked Boxing-looking gist is an unknown
  // target, not a creatable empty slot (spec D4 "remote definitely does not exist").
  function findGistWithFile(gists, fileName) {
    if (!Array.isArray(gists)) return null;
    const target = sanitizeGistFileName(fileName);
    for (const gist of gists) {
      if (!gist || typeof gist !== 'object') continue;
      const files = gist.files;
      if (!files || typeof files !== 'object' || !files[target]) continue;
      const owner = gist.owner && typeof gist.owner === 'object' ? gist.owner : {};
      return {
        gistId: normalizeGistId(gist.id),
        ownerLogin: typeof owner.login === 'string' ? owner.login : '',
        ownerId: normalizeAccountId(owner.id),
      };
    }
    return null;
  }

  // 4xx means GitHub answered "no object was created". 5xx and anything else stays
  // unknown on purpose: a proxy or partially-successful server may have created the
  // Gist even though Boxing did not get a usable answer.
  function classifyGistFailure(status) {
    const code = Number(status) || 0;
    if (code >= 400 && code < 500) {
      return { kind: 'definitive', reasonCode: 'gistRequestRejected' };
    }
    return { kind: 'unknown', reasonCode: 'gistResultUnknown' };
  }

  function accountIdsEqual(a, b) {
    if (!a || !b) return false;
    return String(a.id) === String(b.id);
  }

  // Pure first-create decision. Inputs are already-resolved facts:
  //   settings   — saved Boxing settings (syncProvider/gistId/syncFileName)
  //   cloud      — normalized autoBackupState.cloud
  //   account    — verified GitHub account {login, id} or null
  //   tokenPresent / permission.ok — checked before this call
  // Returns one of: skip, pause, update-not-enabled, create.
  function planGistFirstCreate(input) {
    const opts = input || {};
    const settings = opts.settings || {};
    const cloud = opts.cloud || {};
    const account = opts.account || null;

    if (settings.syncProvider !== 'gist') return { action: 'skip', reasonCode: null };
    if (opts.tokenPresent !== true) return { action: 'pause', reasonCode: 'gistTokenMissing' };
    if (!opts.permission || opts.permission.ok !== true) {
      return { action: 'pause', reasonCode: 'gistPermissionMissing' };
    }
    if (cloud.pendingCreate) return { action: 'pause', reasonCode: 'gistResultUnknown' };

    const fileName = sanitizeGistFileName(settings.syncFileName);
    const rawGistId = typeof settings.gistId === 'string' ? settings.gistId.trim() : '';
    const savedGistId = normalizeGistId(rawGistId);
    // A non-empty but unparseable id is an untrusted target, not "no target".
    // Creating a fresh Gist here would silently ignore the user's saved target.
    if (rawGistId && !savedGistId) {
      return { action: 'pause', reasonCode: 'gistTargetNeedsReview' };
    }
    const baseline = cloud.baseline && cloud.baseline.provider === 'gist' ? cloud.baseline : null;

    // GitHub account id is the stable identity; a renamed login is not a new target.
    if (cloud.account && account && !accountIdsEqual(cloud.account, account)) {
      return { action: 'pause', reasonCode: 'gistAccountChanged' };
    }
    if (baseline && baseline.ownerId && account && String(baseline.ownerId) !== String(account.id)) {
      return { action: 'pause', reasonCode: 'gistAccountChanged' };
    }

    if (savedGistId) {
      if (!baseline) return { action: 'pause', reasonCode: 'gistTargetNeedsReview' };
      if (normalizeGistId(baseline.gistId) !== savedGistId || baseline.fileName !== fileName) {
        return { action: 'pause', reasonCode: 'gistTargetNeedsReview' };
      }
      // Ticket #128 / #120 D4: this is a release blocker, not a "not built yet"
      // placeholder. GitHub declares no conditional write header for Gist PATCH,
      // and no real race test has proven one, so automatic overwrite of an existing
      // Gist stays off until docs/gist-conditional-write.md's gate is cleared.
      return {
        action: 'update-not-enabled',
        reasonCode: 'gistUpdateNotEnabled',
        gistId: savedGistId,
        fileName,
      };
    }

    if (baseline) {
      // The background created this Gist but the NTP settings have not mirrored the
      // id yet (or the user changed the file name). Never POST a second Gist.
      if (baseline.fileName !== fileName) return { action: 'pause', reasonCode: 'gistTargetNeedsReview' };
      return {
        action: 'update-not-enabled',
        reasonCode: 'gistUpdateNotEnabled',
        gistId: normalizeGistId(baseline.gistId),
        fileName,
      };
    }

    return { action: 'create', fileName };
  }

  // Pure manual-write decision for the background queue. "Manual" means the user
  // pressed Backup Now; it never enables unattended updates. The caller supplies
  // token/permission/size facts and the background performs one queued request.
  //   Returns one of: skip, pause, post, patch, confirm-pending.
  function planManualGistWrite(input) {
    const opts = input || {};
    const settings = opts.settings || {};
    const cloud = opts.cloud || {};

    if (settings.syncProvider !== 'gist') return { action: 'skip', reasonCode: null };
    if (opts.tokenPresent !== true) return { action: 'pause', reasonCode: 'gistTokenMissing' };
    if (!opts.permission || opts.permission.ok !== true) {
      return { action: 'pause', reasonCode: 'gistPermissionMissing' };
    }
    if (opts.payloadTooLarge === true) return { action: 'pause', reasonCode: 'gistPayloadTooLarge' };

    const fileName = sanitizeGistFileName(
      typeof opts.fileName === 'string' ? opts.fileName : settings.syncFileName
    );

    // A pending POST can only be recovered when its response carried the Gist id.
    // The background then GETs that Gist, confirms the expected file, records the
    // baseline, and continues with a PATCH instead of POSTing a duplicate. A fully
    // lost response (no id) stays paused for a human check.
    const baseline = cloud.baseline &&
      (cloud.baseline.provider === 'gist' || cloud.baseline.service === 'gist')
      ? cloud.baseline
      : null;
    const rawGistId = typeof opts.gistId === 'string'
      ? opts.gistId.trim()
      : (typeof settings.gistId === 'string' ? settings.gistId.trim() : '');
    const explicitGistId = normalizeGistId(rawGistId);
    const pendingId = cloud.pendingCreate ? normalizeGistId(cloud.pendingCreate.gistId) : '';
    if (cloud.pendingCreate) {
      if (pendingId) {
        // A queued request that names a different target must not be silently
        // PATCHed into the previous pending Gist.
        if ((rawGistId && !explicitGistId) || (explicitGistId && explicitGistId !== pendingId)) {
          return { action: 'pause', reasonCode: 'gistPendingTargetChanged' };
        }
        const knownBaselineId = baseline ? normalizeGistId(baseline.gistId) : '';
        if (knownBaselineId && knownBaselineId !== pendingId) {
          return { action: 'pause', reasonCode: 'gistTargetNeedsReview' };
        }
        return { action: 'confirm-pending', gistId: pendingId, fileName };
      }
      return { action: 'pause', reasonCode: 'gistResultUnknown' };
    }
    // A non-empty but unparseable id is an explicit bad target; never silently
    // fall back to creating a new Gist or to the baseline.
    if (rawGistId && !explicitGistId) {
      return { action: 'pause', reasonCode: 'gistTargetNeedsReview' };
    }

    if (baseline) {
      const baselineId = normalizeGistId(baseline.gistId);
      // An unreadable baseline id cannot prove the target; never fall through to
      // "patch whatever id the page supplied".
      if (!baselineId) return { action: 'pause', reasonCode: 'gistTargetNeedsReview' };
      // A manual write must not silently move a known target or append a second
      // file to the same Gist. Changing either needs an explicit re-target flow.
      if (explicitGistId && explicitGistId !== baselineId) {
        return { action: 'pause', reasonCode: 'gistTargetNeedsReview' };
      }
      if (baseline.fileName && baseline.fileName !== fileName) {
        return { action: 'pause', reasonCode: 'gistTargetNeedsReview' };
      }
    }

    // A second manual click that starts after the background created a Gist but
    // before the page mirrored its id must PATCH that Gist, not POST a duplicate.
    const gistId = explicitGistId || (baseline ? normalizeGistId(baseline.gistId) : '');
    if (gistId) return { action: 'patch', gistId, fileName };
    return { action: 'post', fileName };
  }

  const exported = {
    GIST_CREATE_DESCRIPTION,
    DEFAULT_GIST_FILE_NAME,
    GIST_ID_RE,
    normalizeGistId,
    sanitizeGistFileName,
    buildGistCreateBody,
    buildGistUpdateBody,
    parseGistResponse,
    findGistWithFile,
    classifyGistFailure,
    planGistFirstCreate,
    planManualGistWrite,
  };

  if (root) root.__boxingGistBackupCore = exported;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = exported;
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this);
