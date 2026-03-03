(function ($) {
  "use strict";

  const App = {
    settings: window.S404R
      ? JSON.parse(JSON.stringify(S404R.settings || {}))
      : {},
    pages: window.S404R ? S404R.pages || [] : [],
    rules: [],
    redirects: [],
    activeTab: "general",
    dragSrc: null,
    editingRuleId: null,
    editingRedirectId: null,
    csvPreview: null, // holds parsed rows before confirm-import

    init() {
      this.rules = Array.isArray(this.settings.rules)
        ? this.settings.rules.map((r) => ({ ...r }))
        : [];
      this.redirects = Array.isArray(this.settings.redirects)
        ? this.settings.redirects.map((r) => ({ ...r }))
        : [];
      this.render();
    },

    // ─── SHELL ──────────────────────────────────────────────────────────────────

    render() {
      const app = document.getElementById("s404r-app");
      if (!app) return;
      app.innerHTML = this.shell();
      this.renderRules();
      this.renderRedirects();
      this.renderLog();
      this.bindGlobalEvents();
    },

    shell() {
      const s = this.settings;
      const defRedir = s.default_redirect || "";
      const redirTyp = s.redirect_type || "301";
      const logging = s.logging_enabled ? "checked" : "";
      const logCount = (s.log || []).length;

      return `
        <div class="s404r-header">
          <div class="s404r-logo">&#x1F500;</div>
          <div>
            <h1>Smart 404 Redirect</h1>
            <p>404 handling &bull; page redirects &bull; CSV import &bull; activity logging</p>
          </div>
        </div>

        <div style="max-width:1200px">
          <div class="s404r-tabs" style="margin-bottom:24px">
            <button class="s404r-tab ${this.activeTab === "general" ? "active" : ""}" data-tab="general">&#9881; General</button>
            <button class="s404r-tab ${this.activeTab === "redirects" ? "active" : ""}" data-tab="redirects">&#x21C4; Page Redirects <span class="s404r-tab-count">${this.redirects.length}</span></button>
            <button class="s404r-tab ${this.activeTab === "rules" ? "active" : ""}" data-tab="rules">&#127919; 404 Rules <span class="s404r-tab-count">${this.rules.length}</span></button>
            <button class="s404r-tab ${this.activeTab === "log" ? "active" : ""}" data-tab="log">&#128202; Activity Log</button>
          </div>

          <div id="notice-area"></div>

          <!-- ── GENERAL ── -->
          <div class="s404r-tab-content ${this.activeTab === "general" ? "active" : ""}" id="tab-general">
            <div class="s404r-layout">
              <div class="s404r-card">
                <div class="s404r-card-header"><h2>Default 404 Redirect</h2></div>
                <div class="s404r-card-body">
                  <div class="s404r-field">
                    <label class="s404r-label">Fallback Page</label>
                    <input type="text" id="default_redirect" class="s404r-input mono"
                      value="${this.esc(defRedir)}" placeholder="/404 or https://example.com/not-found">
                    <div class="s404r-hint">Where to send visitors whose 404 URL matches no pattern rule. Leave empty to show WordPress default 404.</div>
                  </div>
                  <div class="s404r-field">
                    <label class="s404r-label">Redirect Type</label>
                    <select id="redirect_type" class="s404r-select">
                      <option value="301" ${redirTyp === "301" ? "selected" : ""}>301 &mdash; Permanent</option>
                      <option value="302" ${redirTyp === "302" ? "selected" : ""}>302 &mdash; Temporary</option>
                    </select>
                  </div>
                  <div class="s404r-field">
                    <label class="s404r-toggle">
                      <input type="checkbox" id="logging_enabled" ${logging}>
                      <div class="s404r-toggle-track"><div class="s404r-toggle-thumb"></div></div>
                      <span class="s404r-toggle-label">Enable Activity Logging</span>
                    </label>
                  </div>
                  <div class="s404r-save-row"><div></div>
                    <button class="s404r-btn s404r-btn-primary" id="save-general">Save Settings</button>
                  </div>
                </div>
              </div>

              <div class="s404r-card">
                <div class="s404r-card-header"><h2>Quick Page Picker</h2></div>
                <div class="s404r-card-body">
                  ${
                    this.pages.length === 0
                      ? `<div class="s404r-empty">No published pages found.</div>`
                      : `<p style="font-size:13px;color:var(--text-muted);margin-top:0">Click any page to set it as the default 404 fallback.</p>
                       <div style="display:flex;flex-direction:column;gap:8px;max-height:320px;overflow-y:auto">
                         ${this.pages
                           .map(
                             (p) => `
                           <div class="s404r-page-pick" data-slug="${this.esc(p.slug)}" data-target="default_redirect">
                             <div style="font-size:13px;font-weight:600;color:var(--text)">${this.esc(p.title)}</div>
                             <div style="font-size:12px;font-family:var(--mono);color:var(--text-muted);margin-top:3px">${this.esc(p.slug)}</div>
                           </div>`,
                           )
                           .join("")}
                       </div>`
                  }
                </div>
              </div>
            </div>
          </div>

          <!-- ── PAGE REDIRECTS ── -->
          <div class="s404r-tab-content ${this.activeTab === "redirects" ? "active" : ""}" id="tab-redirects">
            <div class="s404r-card full-width">
              <div class="s404r-card-header">
                <h2>Page Redirects <span class="s404r-rule-badge" id="redirects-count-badge">${this.redirects.length}</span></h2>
                <div style="display:flex;gap:8px">
                  <button class="s404r-btn s404r-btn-ghost" id="import-csv-btn">&#x2B06; Import CSV</button>
                  <button class="s404r-btn s404r-btn-ghost" id="export-csv-btn">&#x2B07; Export CSV</button>
                  <button class="s404r-btn s404r-btn-ghost" id="add-redirect-btn">+ Add Redirect</button>
                </div>
              </div>
              <div class="s404r-card-body">
                <div class="s404r-info-box">
                  Redirects here fire on <strong>every request</strong>, regardless of whether the page exists or returns a 404.
                  Use this to permanently move pages, rename URLs, or forward old links.
                  Example: <code>/old-about</code> &rarr; <code>/about-us</code>
                </div>

                <!-- CSV IMPORT PANEL (top) -->
                <div id="csv-import-panel" style="display:none">
                  <div class="s404r-csv-panel">
                    <div class="s404r-csv-panel-header">
                      <div>
                        <h3 style="margin:0 0 4px;font-size:14px;color:var(--text)">Import Redirects from CSV</h3>
                        <p style="margin:0;font-size:12px;color:var(--text-muted)">
                          Required columns: <code>from</code>, <code>to</code> &nbsp;&bull;&nbsp;
                          Optional columns: <code>type</code> (301 or 302, default 301), <code>label</code>
                        </p>
                      </div>
                      <button class="s404r-btn s404r-btn-ghost" id="cancel-csv-import" style="flex-shrink:0">&#x2715; Close</button>
                    </div>

                    <div class="s404r-csv-format-example">
                      <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Example CSV format</div>
                      <pre class="s404r-pre">from,to,type,label
/old-page,/new-page,301,Old Page
/blog/2020/post,/blog/post,301,Moved Post
/temp-promo,/promo,302,Promo Redirect</pre>
                    </div>

                    <div id="csv-drop-zone" class="s404r-drop-zone">
                      <div class="s404r-drop-zone-inner">
                        <div class="s404r-drop-icon">&#128196;</div>
                        <div class="s404r-drop-text">Drop your CSV file here</div>
                        <div class="s404r-drop-sub">or</div>
                        <label class="s404r-btn s404r-btn-ghost" style="cursor:pointer">
                          Browse File
                          <input type="file" id="csv-file-input" accept=".csv,text/csv" style="display:none">
                        </label>
                      </div>
                    </div>

                    <div id="csv-preview-area" style="display:none">
                      <div class="s404r-csv-preview-header">
                        <div id="csv-preview-summary"></div>
                        <div style="display:flex;gap:8px;align-items:center">
                          <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-muted);cursor:pointer">
                            <input type="checkbox" id="csv-replace-mode">
                            <span>Replace all existing redirects</span>
                          </label>
                        </div>
                      </div>
                      <div style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">
                        <table class="s404r-log-table" id="csv-preview-table" style="margin:0">
                          <thead>
                            <tr>
                              <th style="width:32px">#</th>
                              <th>From</th>
                              <th>To</th>
                              <th>Type</th>
                              <th>Label</th>
                              <th style="width:60px">Status</th>
                            </tr>
                          </thead>
                          <tbody id="csv-preview-tbody"></tbody>
                        </table>
                      </div>
                      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
                        <button class="s404r-btn s404r-btn-ghost" id="csv-reset-btn">&#x21BA; Choose different file</button>
                        <button class="s404r-btn s404r-btn-primary" id="csv-confirm-import">Import <span id="csv-import-count">0</span> Redirects</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="s404r-save-row" style="margin-bottom:16px">
                  <div style="font-size:12px;color:var(--text-muted)">Exact URL matching &bull; case-insensitive &bull; no wildcards</div>
                  <button class="s404r-btn s404r-btn-primary" id="save-redirects-top">Save All Redirects</button>
                </div>

                <!-- ADD REDIRECT FORM (top, above list) -->
                <div class="s404r-add-rule-form" id="add-redirect-form" style="display:none">
                  <h3>New Page Redirect</h3>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
                    <div style="grid-column:1/-1">
                      <label class="s404r-label">Label (optional)</label>
                      <input type="text" id="new-redir-label" class="s404r-input" placeholder="e.g. Old About Page">
                    </div>
                    <div>
                      <label class="s404r-label">From (source URL)</label>
                      <input type="text" id="new-redir-from" class="s404r-input mono" placeholder="/old-page">
                      <div class="s404r-hint">Exact path to match. No wildcards.</div>
                    </div>
                    <div>
                      <label class="s404r-label">To (destination)</label>
                      <input type="text" id="new-redir-to" class="s404r-input mono" placeholder="/new-page or https://...">
                    </div>
                    <div>
                      <label class="s404r-label">Redirect Type</label>
                      <select id="new-redir-type" class="s404r-select">
                        <option value="301">301 &mdash; Permanent</option>
                        <option value="302">302 &mdash; Temporary</option>
                      </select>
                    </div>
                    <div style="display:flex;align-items:flex-end">
                      <div class="s404r-hint" style="margin:0">
                        <strong>301</strong> = moved permanently (SEO-friendly)<br>
                        <strong>302</strong> = temporary move
                      </div>
                    </div>
                  </div>
                  <div style="display:flex;gap:10px;justify-content:flex-end">
                    <button class="s404r-btn s404r-btn-ghost" id="cancel-add-redirect">Cancel</button>
                    <button class="s404r-btn s404r-btn-success" id="confirm-add-redirect">Add Redirect</button>
                  </div>
                </div>

                <div id="redirects-list" class="s404r-rules-list"></div>

                <div class="s404r-save-row" style="margin-top:24px;border-top:1px solid var(--border);padding-top:20px">
                  <div style="font-size:12px;color:var(--text-muted)">Exact URL matching &bull; case-insensitive &bull; no wildcards</div>
                  <button class="s404r-btn s404r-btn-primary" id="save-redirects">Save All Redirects</button>
                </div>
              </div>
            </div>
          </div>

          <!-- ── 404 RULES ── -->
          <div class="s404r-tab-content ${this.activeTab === "rules" ? "active" : ""}" id="tab-rules">
            <div class="s404r-card full-width">
              <div class="s404r-card-header">
                <h2>404 Pattern Rules <span class="s404r-rule-badge" id="rules-count-badge">${this.rules.length}</span></h2>
                <button class="s404r-btn s404r-btn-ghost" id="add-rule-btn">+ Add Rule</button>
              </div>
              <div class="s404r-card-body">
                <div class="s404r-info-box">
                  These rules only fire when WordPress returns a <strong>404</strong>. Use <code>*</code> as a wildcard.
                  Example: <code>buy-currency/*</code> &rarr; <code>/buy-currency</code>
                </div>

                <div class="s404r-save-row" style="margin-bottom:16px">
                  <div style="font-size:12px;color:var(--text-muted)">Drag to reorder &bull; first match wins</div>
                  <button class="s404r-btn s404r-btn-primary" id="save-rules-top">Save All Rules</button>
                </div>

                <!-- ADD RULE FORM (top, above list) -->
                <div class="s404r-add-rule-form" id="add-rule-form" style="display:none">
                  <h3>New 404 Pattern Rule</h3>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
                    <div>
                      <label class="s404r-label">Rule Name</label>
                      <input type="text" id="new-label" class="s404r-input" placeholder="e.g. Currency Pages">
                    </div>
                    <div>
                      <label class="s404r-label">Redirect Type</label>
                      <select id="new-type" class="s404r-select">
                        <option value="301">301 Permanent</option>
                        <option value="302">302 Temporary</option>
                      </select>
                    </div>
                    <div>
                      <label class="s404r-label">URL Pattern (404 path)</label>
                      <input type="text" id="new-pattern" class="s404r-input mono" placeholder="buy-currency/*">
                      <div class="s404r-hint">No leading slash. Use <code>*</code> as wildcard.</div>
                    </div>
                    <div>
                      <label class="s404r-label">Redirect To</label>
                      <input type="text" id="new-redirect" class="s404r-input mono" placeholder="/buy-currency">
                    </div>
                  </div>
                  <div style="display:flex;gap:10px;justify-content:flex-end">
                    <button class="s404r-btn s404r-btn-ghost" id="cancel-add-rule">Cancel</button>
                    <button class="s404r-btn s404r-btn-success" id="confirm-add-rule">Add Rule</button>
                  </div>
                </div>

                <div id="rules-list" class="s404r-rules-list"></div>

                <div class="s404r-save-row" style="margin-top:24px;border-top:1px solid var(--border);padding-top:20px">
                  <div style="font-size:12px;color:var(--text-muted)">Drag to reorder &bull; first match wins</div>
                  <button class="s404r-btn s404r-btn-primary" id="save-rules">Save All Rules</button>
                </div>
              </div>
            </div>
          </div>

          <!-- ── LOG ── -->
          <div class="s404r-tab-content ${this.activeTab === "log" ? "active" : ""}" id="tab-log">
            <div class="s404r-card full-width">
              <div class="s404r-card-header">
                <h2>Activity Log</h2>
                <button class="s404r-btn s404r-btn-ghost" id="clear-log-btn">Clear Log</button>
                <button id="s404r-export-btn" class="s404r-btn s404r-btn-primary">Export Log as CSV</button>
              </div>
              <div class="s404r-card-body">
                <div class="s404r-stats">
                  <div class="s404r-stat">
                    <div class="s404r-stat-value">${this.redirects.length}</div>
                    <div class="s404r-stat-label">Page Redirects</div>
                  </div>
                  <div class="s404r-stat">
                    <div class="s404r-stat-value">${this.rules.length}</div>
                    <div class="s404r-stat-label">404 Rules</div>
                  </div>
                  <div class="s404r-stat">
                    <div class="s404r-stat-value">${logCount}</div>
                    <div class="s404r-stat-label">Redirects Logged</div>
                  </div>
                </div>
                <div id="log-table-container"></div>
              </div>
            </div>
          </div>
        </div>`;
    },

    // ─── CSV IMPORT ─────────────────────────────────────────────────────────────

    openCsvPanel() {
      const panel = document.getElementById("csv-import-panel");
      if (panel) {
        panel.style.display = "block";
        this.csvPreview = null;
      }
    },

    closeCsvPanel() {
      const panel = document.getElementById("csv-import-panel");
      if (panel) panel.style.display = "none";
      const previewArea = document.getElementById("csv-preview-area");
      const dropZone = document.getElementById("csv-drop-zone");
      if (previewArea) previewArea.style.display = "none";
      if (dropZone) dropZone.style.display = "block";
      const fi = document.getElementById("csv-file-input");
      if (fi) fi.value = "";
      this.csvPreview = null;
    },

    parseCSV(text) {
      const lines = text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split("\n")
        .filter((l) => l.trim());
      if (lines.length < 2)
        return {
          rows: [],
          error: "CSV must have a header row and at least one data row.",
        };

      // Parse a single CSV line respecting quoted fields
      const parseLine = (line) => {
        const cols = [];
        let cur = "",
          inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQ && line[i + 1] === '"') {
              cur += '"';
              i++;
            } else inQ = !inQ;
          } else if (ch === "," && !inQ) {
            cols.push(cur.trim());
            cur = "";
          } else {
            cur += ch;
          }
        }
        cols.push(cur.trim());
        return cols;
      };

      const headers = parseLine(lines[0]).map((h) =>
        h.toLowerCase().replace(/[^a-z0-9_]/g, ""),
      );
      const fromIdx = headers.indexOf("from");
      const toIdx = headers.indexOf("to");
      const typeIdx = headers.indexOf("type");
      const labelIdx = headers.indexOf("label");

      if (fromIdx === -1 || toIdx === -1) {
        return {
          rows: [],
          error: 'CSV must have "from" and "to" column headers.',
        };
      }

      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = parseLine(lines[i]);
        const from = (cols[fromIdx] || "").trim();
        const to = (cols[toIdx] || "").trim();
        const type = typeIdx > -1 ? (cols[typeIdx] || "301").trim() : "301";
        const label = labelIdx > -1 ? (cols[labelIdx] || "").trim() : "";

        let status = "ok";
        let error = "";
        if (!from) {
          status = "error";
          error = 'Missing "from"';
        } else if (!to) {
          status = "error";
          error = 'Missing "to"';
        } else if (!["301", "302"].includes(type)) {
          status = "warn";
          error = "Invalid type, defaulting to 301";
        }

        // check for duplicate "from" within the file
        const dupe = rows.find(
          (r) => r.from && r.from.toLowerCase() === from.toLowerCase(),
        );
        if (dupe) {
          status = "warn";
          error = 'Duplicate "from" in file';
        }

        rows.push({
          row: i,
          from,
          to,
          type: ["301", "302"].includes(type) ? type : "301",
          label,
          status,
          error,
        });
      }
      return { rows, error: null, headers };
    },

    loadCsvFile(file) {
      if (!file || !file.name.match(/\.csv$/i)) {
        this.showNotice("Please select a valid .csv file.", "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = this.parseCSV(e.target.result);
        if (result.error) {
          this.showNotice(result.error, "error");
          return;
        }
        this.csvPreview = result.rows;
        this.renderCsvPreview();
      };
      reader.onerror = () => this.showNotice("Failed to read file.", "error");
      reader.readAsText(file);
    },

    renderCsvPreview() {
      const rows = this.csvPreview || [];
      const dropZone = document.getElementById("csv-drop-zone");
      const previewArea = document.getElementById("csv-preview-area");
      const tbody = document.getElementById("csv-preview-tbody");
      const summary = document.getElementById("csv-preview-summary");
      const countEl = document.getElementById("csv-import-count");
      if (!dropZone || !previewArea || !tbody) return;

      dropZone.style.display = "none";
      previewArea.style.display = "block";

      const okRows = rows.filter((r) => r.status !== "error");
      const errRows = rows.filter((r) => r.status === "error");
      const warnRows = rows.filter((r) => r.status === "warn");

      summary.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <span style="font-size:13px;font-weight:600;color:var(--text)">${rows.length} rows parsed</span>
          ${okRows.length ? `<span class="s404r-csv-badge ok">${okRows.length} valid</span>` : ""}
          ${warnRows.length ? `<span class="s404r-csv-badge warn">${warnRows.length} warnings</span>` : ""}
          ${errRows.length ? `<span class="s404r-csv-badge err">${errRows.length} errors</span>` : ""}
        </div>`;
      if (countEl) countEl.textContent = okRows.length;

      tbody.innerHTML = rows
        .map((r) => {
          const statusIcon =
            r.status === "error"
              ? "&#x2715;"
              : r.status === "warn"
                ? "&#9888;"
                : "&#10003;";
          const statusClass =
            r.status === "error"
              ? "csv-status-error"
              : r.status === "warn"
                ? "csv-status-warn"
                : "csv-status-ok";
          return `<tr class="${r.status === "error" ? "csv-row-error" : ""}">
          <td style="color:var(--text-muted)">${r.row}</td>
          <td class="from">${this.esc(r.from)}</td>
          <td class="to">${this.esc(r.to)}</td>
          <td><span class="s404r-rule-badge ${r.type === "302" ? "warn" : ""}">${this.esc(r.type)}</span></td>
          <td style="color:var(--text-muted)">${this.esc(r.label || "—")}</td>
          <td class="${statusClass}" title="${this.esc(r.error)}">${statusIcon}${r.error ? ` <span style="font-size:10px">${this.esc(r.error)}</span>` : ""}</td>
        </tr>`;
        })
        .join("");
    },

    confirmCsvImport() {
      const rows = (this.csvPreview || []).filter((r) => r.status !== "error");
      const replace =
        document.getElementById("csv-replace-mode") &&
        document.getElementById("csv-replace-mode").checked;

      if (!rows.length) {
        this.showNotice("No valid rows to import.", "error");
        return;
      }

      const newItems = rows.map((r) => ({
        id:
          "redir_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
        label: r.label,
        from: r.from,
        to: r.to,
        type: r.type,
      }));

      if (replace) {
        this.redirects = newItems;
      } else {
        // merge: skip rows whose "from" already exists
        const existing = new Set(
          this.redirects.map((r) => r.from.toLowerCase()),
        );
        let skipped = 0;
        newItems.forEach((item) => {
          if (existing.has(item.from.toLowerCase())) {
            skipped++;
            return;
          }
          this.redirects.push(item);
          existing.add(item.from.toLowerCase());
        });
        if (skipped)
          this.showNotice(
            `Imported ${newItems.length - skipped} rows (${skipped} skipped — duplicate "from" already exists).`,
            "success",
          );
        else
          this.showNotice(
            `Imported ${newItems.length} redirects. Click "Save All Redirects" to persist.`,
            "success",
          );
        this.closeCsvPanel();
        this.renderRedirects();
        return;
      }

      this.showNotice(
        `Imported ${newItems.length} redirects${replace ? " (existing replaced)" : ""}. Click "Save All Redirects" to persist.`,
        "success",
      );
      this.closeCsvPanel();
      this.renderRedirects();
    },

    exportCSV() {
      if (!this.redirects.length) {
        this.showNotice("No redirects to export.", "error");
        return;
      }
      const header = "from,to,type,label\n";
      const rows = this.redirects
        .map((r) => {
          const q = (v) => '"' + String(v || "").replace(/"/g, '""') + '"';
          return [
            q(r.from),
            q(r.to),
            q(r.type || "301"),
            q(r.label || ""),
          ].join(",");
        })
        .join("\n");
      const blob = new Blob([header + rows], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "redirects-export.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    // ─── RENDER: PAGE REDIRECTS ──────────────────────────────────────────────────

    renderRedirects() {
      const list = document.getElementById("redirects-list");
      if (!list) return;
      const badge = document.getElementById("redirects-count-badge");

      if (this.redirects.length === 0) {
        list.innerHTML =
          '<div class="s404r-empty">No page redirects yet. Click &quot;+ Add Redirect&quot; or &quot;Import CSV&quot; to get started.</div>';
        if (badge) badge.textContent = "0";
        return;
      }
      if (badge) badge.textContent = this.redirects.length;

      list.innerHTML = this.redirects
        .map((r, i) => {
          if (this.editingRedirectId === r.id) {
            return `
            <div class="s404r-rule-item editing" data-id="${this.esc(r.id)}">
              <div class="s404r-rule-item-header">
                <span style="font-size:13px;color:var(--accent);font-weight:600">Editing Redirect</span>
                <div style="display:flex;gap:8px">
                  <button class="s404r-btn s404r-btn-ghost redir-cancel-edit" data-id="${this.esc(r.id)}">Cancel</button>
                  <button class="s404r-btn s404r-btn-success redir-save-edit" data-id="${this.esc(r.id)}">Save Changes</button>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:4px">
                <div style="grid-column:1/-1">
                  <label class="s404r-label">Label</label>
                  <input type="text" class="s404r-input edit-redir-label" value="${this.esc(r.label || "")}">
                </div>
                <div>
                  <label class="s404r-label">From</label>
                  <input type="text" class="s404r-input mono edit-redir-from" value="${this.esc(r.from)}">
                </div>
                <div>
                  <label class="s404r-label">To</label>
                  <input type="text" class="s404r-input mono edit-redir-to" value="${this.esc(r.to)}">
                </div>
                <div>
                  <label class="s404r-label">Type</label>
                  <select class="s404r-select edit-redir-type">
                    <option value="301" ${r.type === "301" ? "selected" : ""}>301 Permanent</option>
                    <option value="302" ${r.type === "302" ? "selected" : ""}>302 Temporary</option>
                  </select>
                </div>
              </div>
            </div>`;
          }

          const typeBadge =
            r.type === "302"
              ? '<span class="s404r-rule-badge" style="background:rgba(251,191,36,0.15);color:#fbbf24;border-color:rgba(251,191,36,0.3)">302</span>'
              : '<span class="s404r-rule-badge">301</span>';

          return `
          <div class="s404r-rule-item" data-index="${i}" data-id="${this.esc(r.id)}">
            <div class="s404r-rule-item-header">
              <div style="display:flex;align-items:center;gap:10px">
                <span class="s404r-rule-order">#${i + 1}</span>
                ${r.label ? `<span class="s404r-rule-label">${this.esc(r.label)}</span>` : ""}
                ${typeBadge}
              </div>
              <div style="display:flex;gap:6px">
                <button class="s404r-btn s404r-btn-edit redir-edit-btn" data-id="${this.esc(r.id)}">Edit</button>
                <button class="s404r-btn s404r-btn-danger redir-delete-btn" data-id="${this.esc(r.id)}">Delete</button>
              </div>
            </div>
            <div class="s404r-redirect-row">
              <div class="s404r-value-display">${this.esc(r.from)}</div>
              <div class="s404r-redirect-arrow">&#x2192;</div>
              <div class="s404r-value-display success">${this.esc(r.to)}</div>
            </div>
          </div>`;
        })
        .join("");

      list.querySelectorAll(".redir-edit-btn").forEach((btn) =>
        btn.addEventListener("click", (e) => {
          this.editingRedirectId = e.currentTarget.dataset.id;
          this.renderRedirects();
        }),
      );
      list.querySelectorAll(".redir-cancel-edit").forEach((btn) =>
        btn.addEventListener("click", () => {
          this.editingRedirectId = null;
          this.renderRedirects();
        }),
      );
      list.querySelectorAll(".redir-save-edit").forEach((btn) =>
        btn.addEventListener("click", (e) => {
          const id = e.currentTarget.dataset.id;
          const item = e.currentTarget.closest(".s404r-rule-item");
          const label = (
            item.querySelector(".edit-redir-label").value || ""
          ).trim();
          const from = (
            item.querySelector(".edit-redir-from").value || ""
          ).trim();
          const to = (item.querySelector(".edit-redir-to").value || "").trim();
          const type = item.querySelector(".edit-redir-type").value;
          if (!from || !to) {
            this.showNotice("From and To fields are required.", "error");
            return;
          }
          const idx = this.redirects.findIndex((r) => r.id === id);
          if (idx > -1) this.redirects[idx] = { id, label, from, to, type };
          this.editingRedirectId = null;
          this.renderRedirects();
          this.showNotice(
            'Redirect updated. Click "Save All Redirects" to persist.',
            "success",
          );
        }),
      );
      list.querySelectorAll(".redir-delete-btn").forEach((btn) =>
        btn.addEventListener("click", (e) => {
          if (!confirm("Delete this redirect?")) return;
          const id = e.currentTarget.dataset.id;
          this.redirects = this.redirects.filter((r) => r.id !== id);
          if (this.editingRedirectId === id) this.editingRedirectId = null;
          this.renderRedirects();
          this.showNotice(
            'Redirect removed. Click "Save All Redirects" to persist.',
            "success",
          );
        }),
      );
    },

    // ─── RENDER: 404 RULES ──────────────────────────────────────────────────────

    renderRules() {
      const list = document.getElementById("rules-list");
      if (!list) return;
      const badge = document.getElementById("rules-count-badge");

      if (this.rules.length === 0) {
        list.innerHTML =
          '<div class="s404r-empty">No rules yet. Click &quot;+ Add Rule&quot; to create one.</div>';
        if (badge) badge.textContent = "0";
        return;
      }
      if (badge) badge.textContent = this.rules.length;

      list.innerHTML = this.rules
        .map((rule, i) => {
          if (this.editingRuleId === rule.id) {
            return `
            <div class="s404r-rule-item editing" data-index="${i}" data-id="${this.esc(rule.id)}">
              <div class="s404r-rule-item-header">
                <span style="font-size:13px;color:var(--accent);font-weight:600">Editing Rule</span>
                <div style="display:flex;gap:8px">
                  <button class="s404r-btn s404r-btn-ghost rule-cancel-edit" data-id="${this.esc(rule.id)}">Cancel</button>
                  <button class="s404r-btn s404r-btn-success rule-save-edit" data-id="${this.esc(rule.id)}">Save Changes</button>
                </div>
              </div>
              <div class="s404r-rule-fields">
                <div>
                  <label class="s404r-label">Rule Name</label>
                  <input type="text" class="s404r-input edit-label" value="${this.esc(rule.label)}">
                </div>
                <div>
                  <label class="s404r-label">Type</label>
                  <select class="s404r-select edit-type">
                    <option value="301" ${rule.type === "301" ? "selected" : ""}>301 Permanent</option>
                    <option value="302" ${rule.type === "302" ? "selected" : ""}>302 Temporary</option>
                  </select>
                </div>
                <div>
                  <label class="s404r-label">URL Pattern</label>
                  <input type="text" class="s404r-input mono edit-pattern" value="${this.esc(rule.pattern)}">
                </div>
                <div>
                  <label class="s404r-label">Redirect To</label>
                  <input type="text" class="s404r-input mono edit-redirect" value="${this.esc(rule.redirect_to)}">
                </div>
              </div>
            </div>`;
          }
          return `
          <div class="s404r-rule-item" draggable="true" data-index="${i}" data-id="${this.esc(rule.id)}">
            <div class="s404r-rule-item-header">
              <div style="display:flex;align-items:center;gap:10px">
                <span class="s404r-drag-handle" title="Drag to reorder">&#8285;</span>
                <span class="s404r-rule-order">#${i + 1}</span>
                <span class="s404r-rule-label">${this.esc(rule.label || "Untitled")}</span>
                <span class="s404r-rule-badge">${this.esc(rule.type || "301")}</span>
              </div>
              <div style="display:flex;gap:6px">
                <button class="s404r-btn s404r-btn-edit rule-edit-btn" data-id="${this.esc(rule.id)}">Edit</button>
                <button class="s404r-btn s404r-btn-danger rule-delete-btn" data-id="${this.esc(rule.id)}">Delete</button>
              </div>
            </div>
            <div class="s404r-redirect-row">
              <div class="s404r-value-display">/${this.esc(rule.pattern)}</div>
              <div class="s404r-redirect-arrow">&#x2192;</div>
              <div class="s404r-value-display success">${this.esc(rule.redirect_to)}</div>
            </div>
          </div>`;
        })
        .join("");

      list.querySelectorAll(".rule-edit-btn").forEach((btn) =>
        btn.addEventListener("click", (e) => {
          this.editingRuleId = e.currentTarget.dataset.id;
          this.renderRules();
        }),
      );
      list.querySelectorAll(".rule-cancel-edit").forEach((btn) =>
        btn.addEventListener("click", () => {
          this.editingRuleId = null;
          this.renderRules();
        }),
      );
      list.querySelectorAll(".rule-save-edit").forEach((btn) =>
        btn.addEventListener("click", (e) => {
          const id = e.currentTarget.dataset.id;
          const item = e.currentTarget.closest(".s404r-rule-item");
          const label = (item.querySelector(".edit-label").value || "").trim();
          const pattern = (item.querySelector(".edit-pattern").value || "")
            .trim()
            .replace(/^\//, "");
          const redir = (
            item.querySelector(".edit-redirect").value || ""
          ).trim();
          const type = item.querySelector(".edit-type").value;
          if (!label || !pattern || !redir) {
            this.showNotice("All fields are required.", "error");
            return;
          }
          const idx = this.rules.findIndex((r) => r.id === id);
          if (idx > -1)
            this.rules[idx] = { id, label, pattern, redirect_to: redir, type };
          this.editingRuleId = null;
          this.renderRules();
          this.showNotice(
            'Rule updated. Click "Save All Rules" to persist.',
            "success",
          );
        }),
      );
      list.querySelectorAll(".rule-delete-btn").forEach((btn) =>
        btn.addEventListener("click", (e) => {
          if (!confirm("Delete this rule?")) return;
          const id = e.currentTarget.dataset.id;
          this.rules = this.rules.filter((r) => r.id !== id);
          if (this.editingRuleId === id) this.editingRuleId = null;
          this.renderRules();
          this.showNotice(
            'Rule removed. Click "Save All Rules" to persist.',
            "success",
          );
        }),
      );
      list.querySelectorAll(".s404r-rule-item[draggable]").forEach((item) => {
        item.addEventListener("dragstart", (e) => {
          this.dragSrc = parseInt(item.dataset.index);
          item.classList.add("dragging");
          e.dataTransfer.effectAllowed = "move";
        });
        item.addEventListener("dragend", () =>
          item.classList.remove("dragging"),
        );
        item.addEventListener("dragover", (e) => {
          e.preventDefault();
          item.classList.add("drop-target");
        });
        item.addEventListener("dragleave", () =>
          item.classList.remove("drop-target"),
        );
        item.addEventListener("drop", (e) => {
          e.preventDefault();
          item.classList.remove("drop-target");
          const ti = parseInt(item.dataset.index);
          if (this.dragSrc !== null && this.dragSrc !== ti) {
            const moved = this.rules.splice(this.dragSrc, 1)[0];
            this.rules.splice(ti, 0, moved);
            this.dragSrc = null;
            this.renderRules();
          }
        });
      });
    },

    // ─── RENDER: LOG ────────────────────────────────────────────────────────────

    renderLog() {
      const c = document.getElementById("log-table-container");
      if (!c) return;
      const log = this.settings.log || [];
      if (!log.length) {
        c.innerHTML =
          '<div class="s404r-empty">No redirects logged yet. Enable logging in the General tab.</div>';
        return;
      }
      c.innerHTML =
        '<table class="s404r-log-table"><thead><tr><th>Time</th><th>From</th><th>To</th><th>Rule / Redirect</th></tr></thead><tbody>' +
        log
          .map(
            (e) =>
              `<tr><td>${this.esc(e.time)}</td><td class="from">/${this.esc(e.from)}</td><td class="to">${this.esc(e.to)}</td><td class="rule">${this.esc(e.rule)}</td></tr>`,
          )
          .join("") +
        "</tbody></table>";
    },

    // ─── GLOBAL EVENTS ──────────────────────────────────────────────────────────

    bindGlobalEvents() {
      const app = document.getElementById("s404r-app");

      app.addEventListener("click", (e) => {
        // Tabs
        const tab = e.target.closest(".s404r-tab");
        if (tab && tab.dataset.tab) {
          this.activeTab = tab.dataset.tab;
          app
            .querySelectorAll(".s404r-tab")
            .forEach((t) =>
              t.classList.toggle("active", t.dataset.tab === this.activeTab),
            );
          app
            .querySelectorAll(".s404r-tab-content")
            .forEach((t) =>
              t.classList.toggle("active", t.id === "tab-" + this.activeTab),
            );
          return;
        }
        // Page picker
        const pp = e.target.closest(".s404r-page-pick");
        if (pp) {
          const inp = document.getElementById(
            pp.dataset.target || "default_redirect",
          );
          if (inp) {
            inp.value = pp.dataset.slug;
            this.showNotice("Page selected. Save to apply.", "success");
          }
          return;
        }

        switch (e.target.id) {
          case "save-general":
            return this.saveGeneral();
          case "save-redirects":
          case "save-redirects-top":
            return this.saveRedirects();
          case "save-rules":
          case "save-rules-top":
            return this.saveRules();
          case "clear-log-btn":
            return this.clearLog();
          case "confirm-add-redirect":
            return this.addRedirect();
          case "confirm-add-rule":
            return this.addRule();
          case "import-csv-btn":
            return this.openCsvPanel();
          case "export-csv-btn":
            return this.exportCSV();
          case "cancel-csv-import":
            return this.closeCsvPanel();
          case "csv-reset-btn":
            document.getElementById("csv-preview-area").style.display = "none";
            document.getElementById("csv-drop-zone").style.display = "block";
            const fi = document.getElementById("csv-file-input");
            if (fi) fi.value = "";
            this.csvPreview = null;
            return;
          case "csv-confirm-import":
            return this.confirmCsvImport();
          case "add-redirect-btn": {
            const form = document.getElementById("add-redirect-form");
            form.style.display = "block";
            e.target.style.display = "none";
            form.scrollIntoView({ behavior: "smooth", block: "start" });
            setTimeout(() => {
              const f = document.getElementById("new-redir-from");
              if (f) f.focus();
            }, 150);
            return;
          }
          case "cancel-add-redirect":
            document.getElementById("add-redirect-form").style.display = "none";
            document.getElementById("add-redirect-btn").style.display = "";
            return;
          case "add-rule-btn": {
            const form = document.getElementById("add-rule-form");
            form.style.display = "block";
            e.target.style.display = "none";
            form.scrollIntoView({ behavior: "smooth", block: "start" });
            setTimeout(() => {
              const f = document.getElementById("new-label");
              if (f) f.focus();
            }, 150);
            return;
          }
          case "cancel-add-rule":
            document.getElementById("add-rule-form").style.display = "none";
            document.getElementById("add-rule-btn").style.display = "";
            return;
        }
      });

      // CSV file input change
      app.addEventListener("change", (e) => {
        if (e.target.id === "csv-file-input" && e.target.files[0]) {
          this.loadCsvFile(e.target.files[0]);
        }
      });

      // Drag-and-drop onto the drop zone
      app.addEventListener("dragover", (e) => {
        const dz = e.target.closest("#csv-drop-zone");
        if (dz) {
          e.preventDefault();
          dz.classList.add("drag-over");
        }
      });
      app.addEventListener("dragleave", (e) => {
        const dz = e.target.closest("#csv-drop-zone");
        if (dz) dz.classList.remove("drag-over");
      });
      app.addEventListener("drop", (e) => {
        const dz = e.target.closest("#csv-drop-zone");
        if (dz) {
          e.preventDefault();
          dz.classList.remove("drag-over");
          const file = e.dataTransfer.files[0];
          if (file) this.loadCsvFile(file);
        }
      });
    },

    // ─── AJAX ───────────────────────────────────────────────────────────────────

    saveGeneral() {
      const btn = document.getElementById("save-general");
      btn.disabled = true;
      btn.textContent = "Saving...";
      const payload = {
        action: "s404r_save_general",
        nonce: S404R.nonce,
        default_redirect: (
          document.getElementById("default_redirect").value || ""
        ).trim(),
        redirect_type: document.getElementById("redirect_type").value,
        logging_enabled: document.getElementById("logging_enabled").checked
          ? "1"
          : "0",
      };
      $.post(S404R.ajax_url, payload)
        .done((res) => {
          btn.disabled = false;
          btn.textContent = "Save Settings";
          if (res && res.success) {
            Object.assign(this.settings, {
              default_redirect: payload.default_redirect,
              redirect_type: payload.redirect_type,
              logging_enabled: payload.logging_enabled === "1",
            });
            this.showNotice("Settings saved!", "success");
          } else {
            this.showNotice("Error saving settings.", "error");
          }
        })
        .fail((xhr) => {
          btn.disabled = false;
          btn.textContent = "Save Settings";
          this.showNotice("AJAX failed: " + xhr.status, "error");
          console.error(xhr.responseText);
        });
    },

    saveRedirects() {
      if (this.editingRedirectId) {
        this.showNotice(
          "Please save or cancel the redirect you are editing first.",
          "error",
        );
        return;
      }
      const btns = ["save-redirects", "save-redirects-top"]
        .map((id) => document.getElementById(id))
        .filter(Boolean);
      btns.forEach((b) => {
        b.disabled = true;
        b.textContent = "Saving...";
      });
      $.post(S404R.ajax_url, {
        action: "s404r_save_redirects",
        nonce: S404R.nonce,
        redirects: JSON.stringify(this.redirects),
      })
        .done((res) => {
          btns.forEach((b) => {
            b.disabled = false;
            b.textContent = "Save All Redirects";
          });
          if (res && res.success) {
            this.settings.redirects = this.redirects.map((r) => ({ ...r }));
            this.showNotice("Page redirects saved!", "success");
          } else {
            this.showNotice("Error saving redirects.", "error");
            console.error(res);
          }
        })
        .fail((xhr) => {
          btns.forEach((b) => {
            b.disabled = false;
            b.textContent = "Save All Redirects";
          });
          this.showNotice("AJAX failed: " + xhr.status, "error");
          console.error(xhr.responseText);
        });
    },

    saveRules() {
      if (this.editingRuleId) {
        this.showNotice(
          "Please save or cancel the rule you are editing first.",
          "error",
        );
        return;
      }
      const btns = ["save-rules", "save-rules-top"]
        .map((id) => document.getElementById(id))
        .filter(Boolean);
      btns.forEach((b) => {
        b.disabled = true;
        b.textContent = "Saving...";
      });
      $.post(S404R.ajax_url, {
        action: "s404r_save_rules",
        nonce: S404R.nonce,
        rules: JSON.stringify(this.rules),
      })
        .done((res) => {
          btns.forEach((b) => {
            b.disabled = false;
            b.textContent = "Save All Rules";
          });
          if (res && res.success) {
            this.settings.rules = this.rules.map((r) => ({ ...r }));
            this.showNotice("Rules saved!", "success");
          } else {
            this.showNotice("Error saving rules.", "error");
            console.error(res);
          }
        })
        .fail((xhr) => {
          btns.forEach((b) => {
            b.disabled = false;
            b.textContent = "Save All Rules";
          });
          this.showNotice("AJAX failed: " + xhr.status, "error");
          console.error(xhr.responseText);
        });
    },

    addRedirect() {
      const label = (
        document.getElementById("new-redir-label").value || ""
      ).trim();
      const from = (
        document.getElementById("new-redir-from").value || ""
      ).trim();
      const to = (document.getElementById("new-redir-to").value || "").trim();
      const type = document.getElementById("new-redir-type").value;
      if (!from) {
        this.showNotice("Please enter a From URL.", "error");
        return;
      }
      if (!to) {
        this.showNotice("Please enter a To URL.", "error");
        return;
      }
      this.redirects.push({ id: "redir_" + Date.now(), label, from, to, type });
      // Clear fields but keep form open so user can add another without scrolling
      ["new-redir-label", "new-redir-from", "new-redir-to"].forEach((id) => {
        document.getElementById(id).value = "";
      });
      this.renderRedirects();
      this.showNotice(
        'Redirect added. Click "Save All Redirects" to persist.',
        "success",
      );
      // Re-focus From field for rapid entry
      setTimeout(() => {
        const f = document.getElementById("new-redir-from");
        if (f) f.focus();
      }, 50);
    },

    addRule() {
      const label = (document.getElementById("new-label").value || "").trim();
      const pattern = (document.getElementById("new-pattern").value || "")
        .trim()
        .replace(/^\//, "");
      const redirect = (
        document.getElementById("new-redirect").value || ""
      ).trim();
      const type = document.getElementById("new-type").value;
      if (!label) {
        this.showNotice("Please enter a rule name.", "error");
        return;
      }
      if (!pattern) {
        this.showNotice("Please enter a URL pattern.", "error");
        return;
      }
      if (!redirect) {
        this.showNotice("Please enter a redirect URL.", "error");
        return;
      }
      this.rules.push({
        id: "rule_" + Date.now(),
        label,
        pattern,
        redirect_to: redirect,
        type,
      });
      // Clear fields but keep form open for rapid entry
      ["new-label", "new-pattern", "new-redirect"].forEach((id) => {
        document.getElementById(id).value = "";
      });
      this.renderRules();
      this.showNotice(
        'Rule added. Click "Save All Rules" to persist.',
        "success",
      );
      // Re-focus first field
      setTimeout(() => {
        const f = document.getElementById("new-label");
        if (f) f.focus();
      }, 50);
    },

    clearLog() {
      if (!confirm("Clear all redirect logs?")) return;
      $.post(S404R.ajax_url, {
        action: "s404r_clear_log",
        nonce: S404R.nonce,
      }).done((res) => {
        if (res && res.success) {
          this.settings.log = [];
          this.renderLog();
          this.showNotice("Log cleared.", "success");
        }
      });
    },

    // ─── HELPERS ────────────────────────────────────────────────────────────────

    showNotice(msg, type) {
      const area = document.getElementById("notice-area");
      if (!area) return;
      area.innerHTML = `<div class="s404r-notice ${type}">${msg}</div>`;
      clearTimeout(this._noticeTimer);
      this._noticeTimer = setTimeout(() => {
        area.innerHTML = "";
      }, 6000);
    },

    esc(str) {
      if (str == null) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    },
  };

  window.App = App;
  $(document).ready(() => {
    if (document.getElementById("s404r-app")) App.init();
  });
})(jQuery);

jQuery(document).ready(function ($) {
  $("#s404r-export-btn").on("click", function (e) {
    e.preventDefault();

    if (!confirm("Export the activity log as CSV?")) return;

    $.ajax({
      url: S404R.ajax_url,
      method: "POST",
      data: {
        action: "s404r_export_log",
        nonce: S404R.nonce,
      },
      success: function (response) {
        if (response.success) {
          const csvContent = atob(response.data.content);
          const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;",
          });
          const url = URL.createObjectURL(blob);

          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", response.data.filename);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          alert(response.data.message || "Failed to export log.");
        }
      },
      error: function () {
        alert("AJAX error while exporting log.");
      },
    });
  });
});
