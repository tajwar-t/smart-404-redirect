# Smart 404 Redirect

A lightweight WordPress plugin for intelligently managing redirects across your site. Handles 404 errors with wildcard pattern rules, manages permanent or temporary page-to-page redirects, supports bulk CSV import and export, and keeps an optional activity log of every redirect fired.

---

## Features

- **Page Redirects** — redirect any URL to any destination on every request, whether the page exists or not. Exact path matching, case-insensitive. Each redirect has its own 301 or 302 type.
- **404 Pattern Rules** — wildcard rules that only fire when WordPress returns a 404. Use `*` to match URL segments. Rules evaluate top-to-bottom; first match wins.
- **Default 404 Fallback** — a catch-all redirect for any 404 that matches no pattern rule.
- **CSV Import** — bulk-import page redirects from a `.csv` file. Drag and drop or browse to upload. Live preview with row-level validation before committing. Choose to merge with existing redirects or replace them entirely.
- **CSV Export** — download your current page redirects as a ready-to-reimport `.csv` file.
- **Inline Editing** — edit any saved rule or redirect in place without leaving the page.
- **Drag-and-drop Ordering** — reorder 404 pattern rules by dragging. Priority runs top to bottom.
- **Quick Page Picker** — click any published WordPress page to set it as the default 404 fallback.
- **Activity Log** — optionally log every redirect with timestamp, source path, destination, and matched rule or redirect label. Capped at 100 entries.
- **No external dependencies** — three files, no Composer, no npm, no external services.

---

## Installation

### From ZIP (manual)

1. Download `smart-404-redirect.zip`
2. In your WordPress admin go to **Plugins → Add New → Upload Plugin**
3. Select the ZIP file and click **Install Now**
4. Click **Activate Plugin**

### From source

1. Copy the `smart-404-redirect/` folder into `wp-content/plugins/`
2. Go to **Plugins** in your WordPress admin and activate **Smart 404 Redirect**

After activation navigate to **Settings → Smart 404 Redirect**.

---

## The Four Tabs

### General

Configure the site-wide 404 fallback and logging.

| Setting                     | Description                                                                                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fallback Page**           | Where to send 404 visitors that match no pattern rule. Accepts a relative path (`/not-found`) or a full URL. Leave empty to show the default WordPress 404 template. |
| **Redirect Type**           | Whether the fallback uses `301` permanent or `302` temporary. Does not affect individual page redirects or pattern rules, which each have their own type.            |
| **Enable Activity Logging** | When on, every fired redirect is written to the Activity Log tab.                                                                                                    |

The **Quick Page Picker** panel lists all published pages. Click one to populate the Fallback Page field instantly, then save.

---

### Page Redirects

Redirects that fire on **every request**, whether or not the page exists in WordPress. Use this to move or rename pages, forward old URLs after a site migration, or set up any explicit URL mapping.

Matching is exact and case-insensitive. No wildcards.

#### Adding a redirect manually

1. Click **+ Add Redirect**
2. Fill in the fields:
   - **Label** _(optional)_ — a human-readable name shown in the list and activity log
   - **From** — the source path, e.g. `/old-about`
   - **To** — the destination path or full URL, e.g. `/about-us` or `https://example.com`
   - **Redirect Type** — `301` permanent or `302` temporary
3. Click **Add Redirect** — appears in the list immediately
4. Click **Save All Redirects** to write to the database

#### Editing a redirect

Click **Edit** on any row to expand it inline. Change any field, then click **Save Changes**. The list updates locally — click **Save All Redirects** to persist.

#### Deleting a redirect

Click **Delete** and confirm. Click **Save All Redirects** to persist.

#### Importing from CSV

Click **↑ Import CSV** to open the import panel.

**Supported columns:**

| Column  | Required | Description                                              |
| ------- | -------- | -------------------------------------------------------- |
| `from`  | Yes      | Source path to match, e.g. `/old-page`                   |
| `to`    | Yes      | Destination path or full URL                             |
| `type`  | No       | `301` or `302`. Defaults to `301` if omitted or invalid. |
| `label` | No       | Human-readable name for this redirect                    |

**Example CSV:**

```csv
from,to,type,label
/old-about,/about-us,301,About Page Move
/blog/2019/hello,/blog/hello,301,Old Post
/temp-sale,/sale,302,Seasonal Promo
```

**Steps:**

1. Click **↑ Import CSV** to open the panel
2. Drag and drop a `.csv` file onto the drop zone, or click **Browse File**
3. Review the preview table — each row shows a status:
   - **✓ valid** — will be imported
   - **⚠ warning** — duplicate `from` within the file, or invalid type (still imported with default 301)
   - **✕ error** — missing `from` or `to` field (skipped)
4. Choose your merge strategy:
   - **Default (merge)** — imported rows are appended. Any `from` path that already exists in your current list is skipped.
   - **Replace all existing redirects** — tick the checkbox to wipe the current list and replace it entirely with the imported rows.
5. Click **Import N Redirects** to apply
6. Click **Save All Redirects** to persist to the database

#### Exporting to CSV

Click **↓ Export CSV** to download all current page redirects as `redirects-export.csv`. The file uses the same four-column format and can be re-imported directly.

---

### 404 Rules

Wildcard pattern rules that only fire when WordPress determines a request results in a 404 error. Use these to handle groups of deleted or moved URLs without listing every path individually.

Rules run top-to-bottom. The first rule whose pattern matches the requested URL is used; no further rules are checked.

#### Pattern syntax

Use `*` as a wildcard matching any sequence of characters including slashes. Patterns are matched against the path portion of the URL, without a leading slash. Matching is case-insensitive.

| Pattern           | Matches                                           | Does not match     |
| ----------------- | ------------------------------------------------- | ------------------ |
| `buy-currency/*`  | `/buy-currency/usd`, `/buy-currency/eur/detail`   | `/buy-currency`    |
| `shop/products/*` | `/shop/products/shoes`, `/shop/products/hats/red` | `/shop/categories` |
| `old-page`        | `/old-page` (exact)                               | `/old-page/sub`    |
| `blog/*/archive`  | `/blog/2023/archive`, `/blog/news/archive`        | `/blog/news`       |

#### Adding a rule

1. Click **+ Add Rule**
2. Fill in the fields:
   - **Rule Name** — a label for your reference, e.g. `Currency Pages`
   - **URL Pattern** — no leading slash, use `*` as wildcard, e.g. `buy-currency/*`
   - **Redirect To** — destination path or full URL
   - **Redirect Type** — `301` or `302`
3. Click **Add Rule**
4. Click **Save All Rules** to persist

#### Reordering rules

Drag any rule by the `⠿` handle to change its position. Click **Save All Rules** after reordering.

#### Editing and deleting

Same inline workflow as page redirects — click **Edit**, make changes, **Save Changes**, then **Save All Rules**.

---

### Activity Log

When logging is enabled in the General tab, every redirect fired by the plugin is recorded here.

| Column          | Description                                                                            |
| --------------- | -------------------------------------------------------------------------------------- |
| Time            | When the redirect occurred (site timezone)                                             |
| From            | The path that was requested                                                            |
| To              | The URL the visitor was sent to                                                        |
| Rule / Redirect | The label of the page redirect or 404 rule that matched, or `Default` for the fallback |

The log retains the 100 most recent entries. Click **Clear Log** to wipe it. For high-traffic sites consider leaving logging disabled and using server-level access logs instead.

---

## How the Two Redirect Systems Interact

Both systems hook into `template_redirect`. Page Redirects run first (priority 1), 404 Rules run second (priority 2).

|             | Page Redirects                              | 404 Pattern Rules                    |
| ----------- | ------------------------------------------- | ------------------------------------ |
| Fires when  | Every request                               | Only when WordPress returns a 404    |
| Matching    | Exact path, case-insensitive                | Wildcard patterns, case-insensitive  |
| Ordered     | No (first match by list position)           | Yes, top-to-bottom, first match wins |
| Bulk import | CSV import / export                         | Manual only                          |
| Use for     | Moving pages, site migrations, URL renaming | Handling groups of deleted URLs      |

---

## Redirect Types

| Code  | Name      | When to use                                                                                                                                                                |
| ----- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `301` | Permanent | The old URL is gone for good. Search engines transfer ranking signals to the new URL and remove the old one from their index. Use for site migrations and permanent moves. |
| `302` | Temporary | The redirect is provisional. Search engines keep the original URL indexed. Use during maintenance, A/B testing, or seasonal campaigns.                                     |

When in doubt, use `301`.

---

## CSV Format Reference

```csv
from,to,type,label
/old-page,/new-page,301,Moved Page
/promo,https://example.com/promo,302,External Promo
/legacy,,301,
```

- Column order does not matter as long as headers are present
- `type` accepts `301` or `302`; any other value is treated as `301`
- `label` is optional; leave the cell empty or omit the column entirely
- Blank lines are ignored
- Quoted fields are supported for values containing commas
- The exported file from **↓ Export CSV** is always in this format and can be re-imported

---

## File Structure

```
smart-404-redirect/
├── smart-404-redirect.php   # All PHP — hooks, AJAX handlers, redirect logic
└── assets/
    ├── admin.css            # Admin UI styles
    └── admin.js             # Admin UI — vanilla JS + jQuery AJAX, CSV parser
```

All settings are stored in a single WordPress option (`smart_404_redirect_settings`). No custom database tables are created.

---

## Requirements

- WordPress 5.0 or later
- PHP 7.4 or later
- No additional plugins or libraries required

---

## Frequently Asked Questions

**Will this slow down my site?**
The plugin reads a single database option on every request to check for page redirects. If you have no page redirects configured, the check returns immediately with no further work. The impact is negligible.

**Does it affect SEO?**
Using 301 redirects for permanently moved pages is good SEO practice — it passes link equity and signals to search engines to update their index. Avoid 302 unless the redirect is genuinely temporary.

**What if two page redirects have the same `from` URL?**
The first one in the list is used. When importing via CSV, duplicate `from` values within the file are flagged as warnings and the second occurrence is skipped during a merge import.

**Can I redirect to an external URL?**
Yes. Use a full URL starting with `https://` in any redirect or rule destination field.

**Can I use wildcards in page redirects?**
No. Page redirects use exact path matching only. For wildcard behaviour use 404 Pattern Rules.

**What happens if a URL is in both page redirects and 404 rules?**
Page Redirects fire first. If a page redirect matches the URL, the 404 rules are never reached.

**Is there a limit on how many redirects I can add?**
There is no hard limit. However, all redirects and rules are loaded into memory on every request. For very large lists (thousands of entries), consider whether server-level redirects in `.htaccess` or `nginx.conf` would be more performant.

**The activity log is not recording redirects.**
Make sure **Enable Activity Logging** is checked and saved in the General tab.

---

## Changelog

### 1.4.0

- Added: CSV import for page redirects — drag-and-drop or browse, live row-level preview, merge or replace mode
- Added: CSV export — download current page redirects as a `.csv` file
- Added: import summary showing valid, warning, and error row counts before confirming

### 1.3.0

- Added: Page Redirects tab — exact URL-to-URL redirects that fire on every request, independent of 404 status
- Added: per-redirect 301/302 type selection
- Added: activity log now records page redirects alongside 404 rule hits

### 1.2.0

- Fixed: pattern rules now persist correctly after saving — removed a `sanitize_callback` registered with `register_setting` that was silently overwriting rules on every `update_option()` call
- Improved: AJAX error handling with detailed console output on failure

### 1.1.0

- Added: inline rule editing — click Edit on any saved rule to modify it in place
- Added: rule order indicator (`#1`, `#2`, …) for clarity
- Improved: JS initialisation uses a deep copy of server-provided settings to prevent state divergence

### 1.0.0

- Initial release

---

## License

GPL v2 or later — https://www.gnu.org/licenses/gpl-2.0.html
