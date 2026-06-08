# Flexbook standalone interaction embed (`embed.php`)

Reference for the embed feature: what shipped in **phase 1**, how to use it, and the **phase 2** backlog.

## Overview

`embed.php` renders a **single interaction** (`flexbook_items.id`) in isolation — for embedding in Moodle Pages, Books, labels, or external iframes — without the full Flexbook player (no start screen, chapter nav, interaction header, or completion tracking).

This is **not** the same as `view.php?embed=1&aid=…`, which still loads the full player chrome.

## Phase 1 (implemented)

### URL

```
/mod/flexbook/embed.php?id={flexbook_items.id}
```

**Important:** `id` is the **interaction id** (`flexbook_items.id`), not the course module id.

### Optional query parameters

Embed styling is **not** inherited from the parent Flexbook activity. Only these URL params apply:

| Param | Effect |
|-------|--------|
| `id` (required) | `flexbook_items.id` |
| `dm=1` | Dark mode (`darkmode bg-dark` body class) |
| `kid=1` | Kid theme (`kidtheme` body class) |
| `forcetheme` | Moodle theme name → `$PAGE->force_theme()` |

Example:

```
/mod/flexbook/embed.php?id=42&dm=1&kid=1&forcetheme=boost
```

### Authentication (phase 1)

- Logged-in user with `mod/flexbook:view` on the parent activity.
- Helper: `flexbook_validate_embed_access($itemid, $token = null)` in `lib.php`.
- Also: `flexbook_build_embed_options()`, `flexbook_apply_embed_page_display()`.

### Access behaviour

- **Hidden interactions** (`show=0`): still renderable via direct URL if the user has view capability.
- **Sequence / lock rules** (`preventskip`, etc.): **not** enforced — standalone deep link, not the sequential player.
- No `course_module_viewed`, no Moodle completion, no progress DB reads.

### Body classes

Always applied:

- `path-mod-flexbook`
- `path-mod-interactivevideo` (shared IV/Flexbook CSS)
- `fb-embed-interaction` (embed-only CSS hook)
- `fb-embed-interaction distraction-free` (not `embed-mode` — that class is for `view.php` iframe chrome and breaks embed layout)

Layout fills the viewport (browser tab or iframe box). Set a fixed `height` on the iframe in the parent page.

### Key files

| File | Role |
|------|------|
| `embed.php` | PHP entry (requires `lib.php` explicitly) |
| `templates/embed.mustache` | Minimal DOM shell |
| `amd/src/embed.js` | Bootstrap single interaction |
| `amd/src/embed_messenger.js` | Outbound `postMessage` (ready / loaded / error) |
| `amd/src/embed_parent.js` | Reserved for phase 2 parent helpers |
| `amd/src/type/base.js` | `runEmbedInteraction()`, embed completion bypass |

### Embedding in a Moodle Page

Give the iframe a fixed height (or aspect-ratio wrapper). The embed page fills that box.

```html
<iframe id="fb-embed-42"
        src="/mod/flexbook/embed.php?id=42"
        width="100%"
        height="600"
        style="border:0;"
        title="Interaction"></iframe>
```

### postMessage protocol (phase 1 — embed → parent)

Envelope:

```javascript
{
    source: 'mod_flexbook/embed',
    version: 1,
    type: 'ready' | 'loaded' | 'error',
    itemid: 42,
    payload: { /* type-specific */ }
}
```

| `type` | When | `payload` |
|--------|------|-----------|
| `ready` | AMD init, before content fetch | `{ itemid, type }` |
| `loaded` | Content rendered | `{ itemid }` |
| `error` | Render failure | `{ message }` |

Only sent when `window.parent !== window`. Target origin is `*` for now (phase 2: allowlist).

### Rebuild AMD after JS changes

```powershell
cd /path/to/moodle
npx grunt amd --root=mod/flexbook
```

---

## Phase 2 (planned — not implemented)

Use this section when picking up the next iteration.

### 1. Token-based / external auth

- Extend `flexbook_validate_embed_access()` to accept a `$token` when the user is not logged in.
- Reuse pattern from `classes/output/mobile.php` (`login_after_validate_token()`).
- Goal: embed interactions outside the course context or on external platforms (subject to `X-Frame-Options` / CSP).

Stub today: passing `$token` while logged out throws `invalidtoken`.

### 2. Full parent ↔ embed postMessage protocol

**Parent → embed** (inbound to iframe):

- Use source identifier: `mod_flexbook/embed_parent` (listener stub exists in `embed_messenger.js`).
- Verify `event.source === window.parent`.
- Planned commands: `refresh`, `configure` (runtime dm/kid overrides), `ping`, `scrollIntoView`.

**Embed → parent** (additional outbound):

- `interactioncomplete` — local UI event only (not Moodle completion).
- Forward custom events from content-type plugins.
- `navigate` requests (if ever needed).

Implement handlers in `embed_messenger.js` `onParentMessage()` (currently empty stub).

### 3. Security hardening

- Origin allowlist on both sides (replace `postMessage(..., '*')`).
- Optional signed/tokenized embed URLs.

### 4. Authoring helpers

- Moodle filter or Page helper that auto-generates iframe + `embed_parent` init snippet.
- Admin setting for default embed params.

### 5. Optional enhancements

- `embed_parent.postToEmbed(iframe, type, payload)` helper for parent → child messages.
- Document phase-2 protocol in lang strings / admin docs.

---

## Verification checklist

- [ ] `/mod/flexbook/embed.php?id={valid}` — content only, no header/completion UI
- [ ] Body has `path-mod-interactivevideo`, `path-mod-flexbook`, `fb-embed-interaction`
- [ ] Parent activity dark/kid settings do **not** apply without `dm`/`kid` URL params
- [ ] `?dm=1`, `?kid=1`, `?forcetheme=boost` work independently and combined
- [ ] No access without `mod/flexbook:view`
- [ ] Invalid `id` → `invalidinteraction`
- [ ] Popup-type interaction renders inline (not modal)
- [ ] Hidden interaction still loads with view capability
- [ ] Iframe with fixed height: content fills the iframe box
- [ ] Direct (non-iframe) open: full viewport
- [ ] `loaded` postMessage when framed (no height in payload)

---

## Related

- Full player embed (legacy): `view.php?id={cmid}&embed=1&aid={interaction_id}`
- Plan source: `.cursor/plans/flexbook_embed.php_page_4b313d80.plan.md` (Cursor workspace)
