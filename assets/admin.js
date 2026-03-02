(function ($) {
  'use strict';

  const App = {
    settings: window.S404R ? JSON.parse(JSON.stringify(S404R.settings || {})) : {},
    pages: window.S404R ? (S404R.pages || []) : [],
    rules: [],
    activeTab: 'general',
    dragSrc: null,
    editingId: null,

    init() {
      this.rules = Array.isArray(this.settings.rules)
        ? this.settings.rules.map(r => Object.assign({}, r))
        : [];
      this.render();
    },

    render() {
      const app = document.getElementById('s404r-app');
      if (!app) return;
      app.innerHTML = this.shell();
      this.renderRules();
      this.renderLog();
      this.bindGlobalEvents();
    },

    shell() {
      const s        = this.settings;
      const defRedir = s.default_redirect || '';
      const redirTyp = s.redirect_type || '301';
      const logging  = s.logging_enabled ? 'checked' : '';
      const logCount = (s.log || []).length;

      return `
        <div class="s404r-header">
          <div class="s404r-logo">&#x1F500;</div>
          <div>
            <h1>Smart 404 Redirect</h1>
            <p>Intelligent 404 error handling for WordPress</p>
          </div>
        </div>

        <div style="max-width:1200px">
          <div class="s404r-tabs" style="margin-bottom:24px">
            <button class="s404r-tab ${this.activeTab==='general'?'active':''}" data-tab="general">General</button>
            <button class="s404r-tab ${this.activeTab==='rules'?'active':''}" data-tab="rules">Pattern Rules</button>
            <button class="s404r-tab ${this.activeTab==='log'?'active':''}" data-tab="log">Activity Log</button>
          </div>

          <div id="notice-area"></div>

          <div class="s404r-tab-content ${this.activeTab==='general'?'active':''}" id="tab-general">
            <div class="s404r-layout">
              <div class="s404r-card">
                <div class="s404r-card-header"><h2>Default Redirect</h2></div>
                <div class="s404r-card-body">
                  <div class="s404r-field">
                    <label class="s404r-label">Fallback Page</label>
                    <input type="text" id="default_redirect" class="s404r-input mono"
                      value="${this.esc(defRedir)}"
                      placeholder="/404 or https://example.com/not-found">
                    <div class="s404r-hint">Leave empty to show WordPress default 404. Use a relative path like <code>/404-page</code> or a full URL.</div>
                  </div>
                  <div class="s404r-field">
                    <label class="s404r-label">Redirect Type</label>
                    <select id="redirect_type" class="s404r-select">
                      <option value="301" ${redirTyp==='301'?'selected':''}>301 - Permanent Redirect</option>
                      <option value="302" ${redirTyp==='302'?'selected':''}>302 - Temporary Redirect</option>
                    </select>
                  </div>
                  <div class="s404r-field">
                    <label class="s404r-toggle">
                      <input type="checkbox" id="logging_enabled" ${logging}>
                      <div class="s404r-toggle-track"><div class="s404r-toggle-thumb"></div></div>
                      <span class="s404r-toggle-label">Enable Activity Logging</span>
                    </label>
                  </div>
                  <div class="s404r-save-row">
                    <div></div>
                    <button class="s404r-btn s404r-btn-primary" id="save-general">Save Settings</button>
                  </div>
                </div>
              </div>

              <div class="s404r-card">
                <div class="s404r-card-header"><h2>Quick Page Picker</h2></div>
                <div class="s404r-card-body">
                  ${this.pages.length === 0
                    ? `<div class="s404r-empty"><span class="icon">no pages</span>No published pages found.</div>`
                    : `<p style="font-size:13px;color:var(--text-muted);margin-top:0">Click a page to set it as the default redirect target.</p>
                       <div style="display:flex;flex-direction:column;gap:8px;max-height:320px;overflow-y:auto">
                         ${this.pages.map(p => `
                           <div class="s404r-page-pick" data-slug="${this.esc(p.slug)}">
                             <div style="font-size:13px;font-weight:600;color:var(--text)">${this.esc(p.title)}</div>
                             <div style="font-size:12px;font-family:var(--mono);color:var(--text-muted);margin-top:3px">${this.esc(p.slug)}</div>
                           </div>`).join('')}
                       </div>`
                  }
                </div>
              </div>
            </div>
          </div>

          <div class="s404r-tab-content ${this.activeTab==='rules'?'active':''}" id="tab-rules">
            <div class="s404r-card full-width">
              <div class="s404r-card-header">
                <h2>Pattern Rules <span class="s404r-rule-badge" id="rules-count-badge">${this.rules.length} rules</span></h2>
                <button class="s404r-btn s404r-btn-ghost" id="add-rule-btn">+ Add Rule</button>
              </div>
              <div class="s404r-card-body">
                <p style="font-size:13px;color:var(--text-muted);margin-top:0">
                  Rules run top-to-bottom. First match wins. Use <code style="background:var(--surface2);padding:1px 6px;border-radius:4px;color:var(--accent);font-size:12px">*</code> as wildcard.
                  Example: pattern <code style="background:var(--surface2);padding:1px 6px;border-radius:4px;color:var(--accent);font-size:12px">buy-currency/*</code> redirects to <code style="background:var(--surface2);padding:1px 6px;border-radius:4px;color:var(--success);font-size:12px">/buy-currency</code>
                </p>

                <div id="rules-list" class="s404r-rules-list"></div>

                <div class="s404r-add-rule-form" id="add-rule-form" style="display:none">
                  <h3>New Pattern Rule</h3>
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
                      <label class="s404r-label">URL Pattern</label>
                      <input type="text" id="new-pattern" class="s404r-input mono" placeholder="buy-currency/*">
                      <div class="s404r-hint">No leading slash. Use <code>*</code> as wildcard.</div>
                    </div>
                    <div>
                      <label class="s404r-label">Redirect To</label>
                      <input type="text" id="new-redirect" class="s404r-input mono" placeholder="/buy-currency">
                      <div class="s404r-hint">Relative path or full URL.</div>
                    </div>
                  </div>
                  <div style="display:flex;gap:10px;justify-content:flex-end">
                    <button class="s404r-btn s404r-btn-ghost" id="cancel-add-rule">Cancel</button>
                    <button class="s404r-btn s404r-btn-success" id="confirm-add-rule">Add Rule</button>
                  </div>
                </div>

                <div class="s404r-save-row" style="margin-top:24px;border-top:1px solid var(--border);padding-top:20px">
                  <div style="font-size:12px;color:var(--text-muted)">Drag rows to reorder &bull; Click Edit to modify inline</div>
                  <button class="s404r-btn s404r-btn-primary" id="save-rules">Save All Rules</button>
                </div>
              </div>
            </div>
          </div>

          <div class="s404r-tab-content ${this.activeTab==='log'?'active':''}" id="tab-log">
            <div class="s404r-card full-width">
              <div class="s404r-card-header">
                <h2>Activity Log</h2>
                <button class="s404r-btn s404r-btn-ghost" id="clear-log-btn">Clear Log</button>
              </div>
              <div class="s404r-card-body">
                <div class="s404r-stats">
                  <div class="s404r-stat">
                    <div class="s404r-stat-value">${this.rules.length}</div>
                    <div class="s404r-stat-label">Active Rules</div>
                  </div>
                  <div class="s404r-stat">
                    <div class="s404r-stat-value">${logCount}</div>
                    <div class="s404r-stat-label">Redirects Logged</div>
                  </div>
                  <div class="s404r-stat" style="overflow:hidden">
                    <div class="s404r-stat-value" style="font-size:14px;word-break:break-all">${this.esc(s.default_redirect || '-')}</div>
                    <div class="s404r-stat-label">Default Target</div>
                  </div>
                </div>
                <div id="log-table-container"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    },

    renderRules() {
      const list = document.getElementById('rules-list');
      if (!list) return;

      if (this.rules.length === 0) {
        list.innerHTML = '<div class="s404r-empty"><span class="icon" style="font-size:32px;display:block;margin-bottom:8px">&#127919;</span>No rules yet. Click &quot;+ Add Rule&quot; to create your first pattern.</div>';
        const badge = document.getElementById('rules-count-badge');
        if (badge) badge.textContent = '0 rules';
        return;
      }

      list.innerHTML = this.rules.map((rule, i) => {
        const isEditing = this.editingId === rule.id;
        if (isEditing) {
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
                  <input type="text" class="s404r-input edit-label" value="${this.esc(rule.label)}" placeholder="Rule name">
                </div>
                <div>
                  <label class="s404r-label">Redirect Type</label>
                  <select class="s404r-select edit-type">
                    <option value="301" ${rule.type==='301'?'selected':''}>301 Permanent</option>
                    <option value="302" ${rule.type==='302'?'selected':''}>302 Temporary</option>
                  </select>
                </div>
                <div>
                  <label class="s404r-label">URL Pattern</label>
                  <input type="text" class="s404r-input mono edit-pattern" value="${this.esc(rule.pattern)}" placeholder="buy-currency/*">
                </div>
                <div>
                  <label class="s404r-label">Redirect To</label>
                  <input type="text" class="s404r-input mono edit-redirect" value="${this.esc(rule.redirect_to)}" placeholder="/buy-currency">
                </div>
              </div>
            </div>`;
        }

        return `
          <div class="s404r-rule-item" draggable="true" data-index="${i}" data-id="${this.esc(rule.id)}">
            <div class="s404r-rule-item-header">
              <div style="display:flex;align-items:center;gap:10px">
                <span class="s404r-drag-handle" title="Drag to reorder">&#8285;</span>
                <span class="s404r-rule-order">#${i+1}</span>
                <span class="s404r-rule-label">${this.esc(rule.label || 'Untitled Rule')}</span>
                <span class="s404r-rule-badge">${this.esc(rule.type || '301')}</span>
              </div>
              <div style="display:flex;gap:6px">
                <button class="s404r-btn s404r-btn-edit rule-edit-btn" data-id="${this.esc(rule.id)}">Edit</button>
                <button class="s404r-btn s404r-btn-danger rule-delete-btn" data-id="${this.esc(rule.id)}">Delete</button>
              </div>
            </div>
            <div class="s404r-rule-fields">
              <div>
                <div class="s404r-label">Pattern (404 URL)</div>
                <div class="s404r-value-display">/${this.esc(rule.pattern)}</div>
              </div>
              <div>
                <div class="s404r-label">Redirect To</div>
                <div class="s404r-value-display success">${this.esc(rule.redirect_to)}</div>
              </div>
            </div>
          </div>`;
      }).join('');

      const badge = document.getElementById('rules-count-badge');
      if (badge) badge.textContent = this.rules.length + ' rules';

      this.bindRuleItemEvents(list);
    },

    bindRuleItemEvents(list) {
      list.querySelectorAll('.rule-edit-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          this.editingId = e.currentTarget.dataset.id;
          this.renderRules();
        });
      });

      list.querySelectorAll('.rule-cancel-edit').forEach(btn => {
        btn.addEventListener('click', () => {
          this.editingId = null;
          this.renderRules();
        });
      });

      list.querySelectorAll('.rule-save-edit').forEach(btn => {
        btn.addEventListener('click', e => {
          const id   = e.currentTarget.dataset.id;
          const item = e.currentTarget.closest('.s404r-rule-item');
          const label   = (item.querySelector('.edit-label').value || '').trim();
          const pattern = (item.querySelector('.edit-pattern').value || '').trim().replace(/^\//, '');
          const redirect= (item.querySelector('.edit-redirect').value || '').trim();
          const type    = item.querySelector('.edit-type').value;

          if (!label || !pattern || !redirect) {
            this.showNotice('All fields are required.', 'error');
            return;
          }

          const idx = this.rules.findIndex(r => r.id === id);
          if (idx > -1) {
            this.rules[idx] = { id, label, pattern, redirect_to: redirect, type };
          }
          this.editingId = null;
          this.renderRules();
          this.showNotice('Rule updated locally. Click "Save All Rules" to persist.', 'success');
        });
      });

      list.querySelectorAll('.rule-delete-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          const id = e.currentTarget.dataset.id;
          if (!confirm('Delete this rule?')) return;
          this.rules = this.rules.filter(r => r.id !== id);
          if (this.editingId === id) this.editingId = null;
          this.renderRules();
          this.showNotice('Rule removed. Click "Save All Rules" to persist.', 'success');
        });
      });

      list.querySelectorAll('.s404r-rule-item[draggable]').forEach(item => {
        item.addEventListener('dragstart', e => {
          this.dragSrc = parseInt(item.dataset.index);
          item.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
        });
        item.addEventListener('dragend', () => item.classList.remove('dragging'));
        item.addEventListener('dragover', e => { e.preventDefault(); item.classList.add('drop-target'); });
        item.addEventListener('dragleave', () => item.classList.remove('drop-target'));
        item.addEventListener('drop', e => {
          e.preventDefault();
          item.classList.remove('drop-target');
          const targetIdx = parseInt(item.dataset.index);
          if (this.dragSrc !== null && this.dragSrc !== targetIdx) {
            const moved = this.rules.splice(this.dragSrc, 1)[0];
            this.rules.splice(targetIdx, 0, moved);
            this.dragSrc = null;
            this.renderRules();
          }
        });
      });
    },

    renderLog() {
      const container = document.getElementById('log-table-container');
      if (!container) return;
      const log = this.settings.log || [];
      if (log.length === 0) {
        container.innerHTML = '<div class="s404r-empty">No redirects logged yet. Enable logging in the General tab.</div>';
        return;
      }
      container.innerHTML = '<table class="s404r-log-table"><thead><tr><th>Time</th><th>From (404)</th><th>To (Redirect)</th><th>Matched Rule</th></tr></thead><tbody>' +
        log.map(function(e) {
          return '<tr><td>' + this.esc(e.time) + '</td><td class="from">/' + this.esc(e.from) + '</td><td class="to">' + this.esc(e.to) + '</td><td class="rule">' + this.esc(e.rule) + '</td></tr>';
        }, this).join('') +
        '</tbody></table>';
    },

    bindGlobalEvents() {
      const app = document.getElementById('s404r-app');

      app.addEventListener('click', e => {
        const tab = e.target.closest('.s404r-tab');
        if (tab && tab.dataset.tab) {
          this.activeTab = tab.dataset.tab;
          app.querySelectorAll('.s404r-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === this.activeTab));
          app.querySelectorAll('.s404r-tab-content').forEach(t => t.classList.toggle('active', t.id === 'tab-' + this.activeTab));
          return;
        }

        const pagePick = e.target.closest('.s404r-page-pick');
        if (pagePick) {
          const slug = pagePick.dataset.slug;
          const inp = document.getElementById('default_redirect');
          if (inp) { inp.value = slug; this.showNotice('Page selected. Save Settings to apply.', 'success'); }
          return;
        }

        const id = e.target.id;
        if (id === 'save-general')     return this.saveGeneral();
        if (id === 'save-rules')       return this.saveRules();
        if (id === 'clear-log-btn')    return this.clearLog();
        if (id === 'confirm-add-rule') return this.addRule();

        if (id === 'add-rule-btn') {
          document.getElementById('add-rule-form').style.display = 'block';
          e.target.style.display = 'none';
          return;
        }
        if (id === 'cancel-add-rule') {
          document.getElementById('add-rule-form').style.display = 'none';
          document.getElementById('add-rule-btn').style.display = '';
          return;
        }
      });
    },

    saveGeneral() {
      const btn = document.getElementById('save-general');
      btn.disabled = true; btn.textContent = 'Saving...';

      const payload = {
        action:           's404r_save_general',
        nonce:            S404R.nonce,
        default_redirect: (document.getElementById('default_redirect').value || '').trim(),
        redirect_type:    document.getElementById('redirect_type').value,
        logging_enabled:  document.getElementById('logging_enabled').checked ? '1' : '0',
      };

      $.post(S404R.ajax_url, payload)
        .done(res => {
          btn.disabled = false; btn.textContent = 'Save Settings';
          if (res && res.success) {
            this.settings.default_redirect = payload.default_redirect;
            this.settings.redirect_type    = payload.redirect_type;
            this.settings.logging_enabled  = payload.logging_enabled === '1';
            this.showNotice('Settings saved!', 'success');
          } else {
            this.showNotice('Error: ' + (res && res.data ? res.data.message : 'unknown error'), 'error');
          }
        })
        .fail((xhr) => {
          btn.disabled = false; btn.textContent = 'Save Settings';
          this.showNotice('AJAX failed: ' + xhr.status + ' ' + xhr.statusText, 'error');
          console.error('s404r fail:', xhr.responseText);
        });
    },

    saveRules() {
      if (this.editingId) {
        this.showNotice('Please save or cancel the rule you are editing first.', 'error');
        return;
      }
      const btn = document.getElementById('save-rules');
      btn.disabled = true; btn.textContent = 'Saving...';

      $.post(S404R.ajax_url, {
        action: 's404r_save_rules',
        nonce:  S404R.nonce,
        rules:  JSON.stringify(this.rules),
      })
      .done(res => {
        btn.disabled = false; btn.textContent = 'Save All Rules';
        if (res && res.success) {
          this.settings.rules = this.rules.map(r => Object.assign({}, r));
          this.showNotice('Rules saved successfully!', 'success');
        } else {
          this.showNotice('Error saving rules. Check console.', 'error');
          console.error('s404r save_rules:', res);
        }
      })
      .fail((xhr) => {
        btn.disabled = false; btn.textContent = 'Save All Rules';
        this.showNotice('AJAX failed: ' + xhr.status + ' ' + xhr.statusText, 'error');
        console.error('s404r fail:', xhr.responseText);
      });
    },

    addRule() {
      const label   = (document.getElementById('new-label').value    || '').trim();
      const pattern = (document.getElementById('new-pattern').value  || '').trim().replace(/^\//, '');
      const redirect= (document.getElementById('new-redirect').value || '').trim();
      const type    = document.getElementById('new-type').value;

      if (!label)    { this.showNotice('Please enter a rule name.', 'error');    return; }
      if (!pattern)  { this.showNotice('Please enter a URL pattern.', 'error'); return; }
      if (!redirect) { this.showNotice('Please enter a redirect URL.', 'error'); return; }

      this.rules.push({ id: 'rule_' + Date.now(), label, pattern, redirect_to: redirect, type });
      ['new-label','new-pattern','new-redirect'].forEach(id => { document.getElementById(id).value = ''; });
      document.getElementById('add-rule-form').style.display = 'none';
      document.getElementById('add-rule-btn').style.display  = '';
      this.renderRules();
      this.showNotice('Rule added. Click "Save All Rules" to persist.', 'success');
    },

    clearLog() {
      if (!confirm('Clear all redirect logs?')) return;
      $.post(S404R.ajax_url, { action: 's404r_clear_log', nonce: S404R.nonce })
        .done(res => {
          if (res && res.success) {
            this.settings.log = [];
            this.renderLog();
            this.showNotice('Log cleared.', 'success');
          }
        });
    },

    showNotice(msg, type) {
      const area = document.getElementById('notice-area');
      if (!area) return;
      area.innerHTML = '<div class="s404r-notice ' + type + '">' + msg + '</div>';
      clearTimeout(this._noticeTimer);
      this._noticeTimer = setTimeout(() => { area.innerHTML = ''; }, 5000);
    },

    esc(str) {
      if (str === undefined || str === null) return '';
      return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    },
  };

  window.App = App;

  $(document).ready(function () {
    if (document.getElementById('s404r-app')) {
      App.init();
    }
  });

})(jQuery);
