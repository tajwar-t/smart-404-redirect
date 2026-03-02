# Smart 404 Redirect

A lightweight WordPress plugin that intelligently handles 404 errors by redirecting visitors to relevant pages — with support for wildcard URL pattern matching, per-rule redirect types, drag-and-drop rule ordering, and an optional activity log.

---

## Features

- **Default fallback redirect** — send all unmatched 404s to any page or URL
- **Pattern-based rules** — match URL segments using `*` wildcards and redirect to different destinations per pattern
- **Per-rule redirect type** — choose 301 (permanent) or 302 (temporary) independently for each rule and for the global default
- **Inline rule editing** — edit any saved rule directly in the admin UI without leaving the page
- **Drag-and-drop ordering** — rules are evaluated top-to-bottom; reorder them by dragging
- **Quick Page Picker** — click any published WordPress page to instantly set it as the default redirect target
- **Activity log** — optionally log every redirect with timestamp, source URL, destination, and the rule that matched (stores the last 100 entries)
- **No external dependencies** — single PHP file plus two asset files, no composer, no npm

---

## Installation

### From ZIP (manual)

1. Download `smart-404-redirect.zip`
2. In your WordPress admin go to **Plugins → Add New → Upload Plugin**
3. Choose the ZIP file and click **Install Now**
4. Click **Activate Plugin**

### From source

1. Copy the `smart-404-redirect/` folder into your site's `wp-content/plugins/` directory
2. Go to **Plugins** in your WordPress admin and activate **Smart 404 Redirect**

---

## Getting Started

After activation, navigate to **Settings → Smart 404 Redirect** in your WordPress admin. The settings page has three tabs.

### General Tab

| Setting                     | Description                                                                                                                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fallback Page**           | The URL to redirect all 404s that don't match any pattern rule. Accepts a relative path (e.g. `/not-found`) or a full URL. Leave empty to show the WordPress default 404 template. |
| **Redirect Type**           | Whether the default fallback uses a `301` permanent or `302` temporary redirect.                                                                                                   |
| **Enable Activity Logging** | When checked, every redirect is written to the Activity Log.                                                                                                                       |

The **Quick Page Picker** panel on the same tab lists all published pages on your site. Click any page to populate the Fallback Page field with its path, then save.

### Pattern Rules Tab

Pattern rules let you redirect specific groups of 404 URLs to different destinations. For example, if your `/buy-currency/usd` page was deleted but `/buy-currency` still exists, you can redirect all `/buy-currency/*` 404s back to `/buy-currency` instead of your generic 404 page.

**Adding a rule**

1. Click **+ Add Rule**
2. Fill in the four fields:
   - **Rule Name** — a label for your own reference (e.g. `Currency Pages`)
   - **URL Pattern** — the path to match, without a leading slash, using `*` as a wildcard (e.g. `buy-currency/*`)
   - **Redirect To** — the destination path or full URL (e.g. `/buy-currency`)
   - **Redirect Type** — `301` or `302` for this rule specifically
3. Click **Add Rule** — the rule appears in the list
4. Click **Save All Rules** to persist changes to the database

**Editing a rule**

Click the **Edit** button on any rule to expand it into an inline editable form. Make your changes, then click **Save Changes**. The rule updates in the local list — click **Save All Rules** to write to the database.

**Reordering rules**

Drag any rule by its handle (`⠿`) to change its position. Rules are evaluated strictly top-to-bottom and the first match wins. Click **Save All Rules** after reordering.

**Deleting a rule**

Click **Delete** on any rule and confirm the prompt. Click **Save All Rules** to persist the removal.

### Activity Log Tab

When logging is enabled, every redirect the plugin performs is recorded here. The log shows:

- **Time** — when the redirect happened (site timezone)
- **From** — the 404 URL that was requested
- **To** — the URL the visitor was sent to
- **Matched Rule** — the name of the pattern rule that triggered, or `Default` for the fallback

The log retains the 100 most recent entries. Click **Clear Log** to wipe it.

---

## How Pattern Matching Works

The URL pattern is matched against the path portion of the requested URL (everything after the domain, before any query string). Matching is case-insensitive.

The `*` wildcard matches any sequence of characters, including slashes.

| Pattern           | Matches                                         | Does not match    |
| ----------------- | ----------------------------------------------- | ----------------- |
| `buy-currency/*`  | `buy-currency/usd`, `buy-currency/eur/detail`   | `buy-currency`    |
| `shop/products/*` | `shop/products/shoes`, `shop/products/hats/red` | `shop/categories` |
| `old-page`        | `old-page` (exact)                              | `old-page/sub`    |
| `blog/*/archive`  | `blog/2023/archive`, `blog/news/archive`        | `blog/news`       |

Rules are tested in order. The first rule whose pattern matches the requested URL is used, and no further rules are checked.

If no rule matches, the plugin falls back to the **Fallback Page** setting. If that is also empty, WordPress renders its default 404 template.

---

## Redirect Types

| Code  | Name      | Use when                                                                                                                 |
| ----- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| `301` | Permanent | The old URL is gone for good. Search engines will transfer ranking signals to the new URL and stop indexing the old one. |
| `302` | Temporary | The redirect is provisional. Search engines keep the original URL indexed. Use during maintenance or A/B testing.        |

When in doubt, use `301`.

---

## File Structure

```
smart-404-redirect/
├── smart-404-redirect.php   # Main plugin file — all PHP logic
└── assets/
    ├── admin.css            # Admin UI styles
    └── admin.js             # Admin UI — vanilla JS + jQuery AJAX
```

All plugin settings are stored in a single WordPress option (`smart_404_redirect_settings`) as a serialised array. No custom database tables are created.

---

## Requirements

- WordPress 5.0 or later
- PHP 7.2 or later
- No additional plugins or libraries required

---

## Frequently Asked Questions

**Will this affect my site's front end?**
No. The plugin only adds a hook on `template_redirect` that fires when WordPress determines a request results in a 404. It has no effect on pages that load normally.

**Does it affect SEO?**
Using 301 redirects for permanently removed pages is generally beneficial for SEO — it signals to search engines that content has moved and passes link equity to the destination. Avoid using 302 unless the redirect is genuinely temporary.

**What happens if two rules match the same URL?**
Only the first matching rule (top of the list) is used. Reorder your rules so more specific patterns appear above broader ones.

**Can I redirect to an external URL?**
Yes. Enter a full URL (starting with `https://`) in either the Fallback Page field or the Redirect To field of any rule.

**Is the activity log stored in the database?**
Yes, log entries are appended to the plugin's settings option. The log is capped at 100 entries to avoid unbounded growth. For high-traffic sites, consider leaving logging disabled and using server-level access logs instead.

**Can I use this alongside other redirect plugins?**
Generally yes, but be aware of priority conflicts. This plugin hooks into `template_redirect` at priority `1` (earlier than most plugins) so its redirects fire first.

---

## Changelog

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
