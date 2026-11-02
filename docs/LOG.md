# Build log

## 2026-11-02 · Step 1–2: repo + theme

**Done**
- Created the local git repo `redstring` (branch `main`). Author: Praneeth only, no co-author trailers.
- Built the theme: `static/css/redstring.css` + `static/js/redstring.js`.
- Built the preview page (now `index.html`).

**Theme at a glance**
- Day: warm paper desk, cork board, manila folders. Night shift: dark desk, lamp glow, brighter red string.
- Fonts: Bricolage Grotesque (headings/body), JetBrains Mono (typewriter labels).
- Components: top bar, search, type filter chips, evidence board (pinned index cards + sagging red strings
  with link labels), case-file page (folder tab, facts table, stamps, "strings" list),
  findings log, idea stages, redaction bars, empty states.
- 7 entity colours: product, concept, competitor, trend, idea, person, source.
- Stamps: VERIFIED (green), INFERRED (amber), ACTIVE LEAD (red).
- Redaction: unverified text hides behind a black bar until you hover or tab to it.

**Scope kept out (on purpose)**
- No cyber/cert tracker. Only product info for now.
- Sample content uses public facts only.

**Verified (headless Chromium)**
- Light, night shift and mobile (390px) all render. 0 console errors.
- 9/9 strings drawn. Turning off "trend" hides 2 strings (9 → 7).
- Night-shift toggle switches the theme. No horizontal page scroll on mobile.
- Fix applied: string labels moved to a layer above the cards so none hide.

**Next**
- Create the GitHub repo and push.
- Step 3: import the 93 vault notes into the entity/link model.

## 2026-11-02 · Board fix: tight strings + clean labels

**Problem:** strings sagged like wet noodles; outlined text sitting on the lines looked messy.

**Done**
- Strings are now straight and taut, pin to pin, with a faint twine texture.
- Labels became small paper tags, angled along the string and never upside down.
- Tags are hidden by default. They show when you hover a card (its strings only) or turn on the new **labels** switch.
- Each tag sits on the longest stretch of string that isn't covered by a card.
- Spread out the PkeyFx cluster so its short strings have room.

**Verified (headless Chromium, light + night shift)**
- 9 strings, 9 tags, 0 errors.
- Hovering PkeyFx lights up its 4 strings and dims the rest.
- With labels on, no tag overlaps a card.

## 2026-11-02 · Vercel ready

**Done**
- Moved the preview page to the root `index.html`, so Vercel serves it with no build step.
- Added `vercel.json`: clean URLs plus `noindex`, `DENY` framing and `nosniff` headers.
- Added `robots.txt` to block all crawlers.

**Verified:** served from a local static server, the page loads its CSS and JS, draws 9 strings and shows 0 errors.

## 2026-11-02 · Split into pages

**Done**
- `index.html` shows only the board. Case files, Findings and Ideas each have their own page.
- Case files page: a "drawer" index of all 10 entities, plus the open PkeyFx file.
- Board cards link to their pages (PkeyFx opens `cases.html#pkeyfx`, the idea card opens `ideas.html`).
- Removed the tokens/kit section completely.
- Phones get a nav row under the logo (it used to be hidden).

**Verified (desktop + 390px phone):** all 4 pages load with the right nav item active, links work, 0 errors, 0 missing files, no sideways scroll.

## 2026-11-02 · Working app: notes, cards, search, writing

**Done**
- **Data store** (`store.js`): files, strings, findings and idea stages, saved in the browser.
  Validated on load and on restore. Tabs stay in sync.
- **Board:** drag to arrange (positions saved), pin new cards in the emptiest spot or by double-click,
  🧵 tie mode (click two cards, pick the relation), click a label to cut a string, type filters remembered.
- **Case files:** drawer with filter/type/sort; file view with editable details, clickable stamp,
  facts editor (unverified values redacted), markdown notes with autosave, strings (tie in either direction),
  **Mentions** (files named in notes, with one-click "tie"), and findings for the file.
- **Findings:** composer with tag picker + `[[Name]]` auto-tagging, stamps, saved drafts,
  filters (text / file / stamp), inline edit, delete.
- **Ideas:** 5-stage pipeline, drag & drop, ‹ › buttons, arrow keys.
- **Everywhere:** global search (`/`, arrow keys, Enter), quick jot (`N`), backup/restore/reset in the footer.
- **Safety:** all user text is escaped; links allow only http(s)/mailto/relative URLs.

**Verified:** 45 automated browser checks passed: every feature above, reload persistence,
backup → reset → restore, an HTML/JS injection attempt (blocked), no sideways scroll on 5 phone views,
0 console errors.

**Known limits:** data lives in one browser (back up often). No sync until the backend is built.

## 2026-11-02 · Calmer case file + full width

**Problem:** the case file felt cluttered. Strings and Mentions repeated the same files, and notes had too little room.

**Done**
- **Full width:** pages fill the screen (no 1180px cap). The board grows with the window.
- **Notes are the main area:** wide left column that grows as you write. One **✎ write / ✓ done** button; Esc also returns to reading.
- **Sidebar** (right): Facts, Connections, Findings.
- **Connections** replace Strings + Mentions: grouped by relation as chips ("driven by: 47-day TLS, Post-quantum").
  Names from your notes that aren't connected yet show once, as "+ name" suggestions.
  **+ connect** opens a short dialog that reads like a sentence.
- **Findings in the sidebar:** one line, press Enter.
- **New: evidence meter** under the title. It counts stamps on the file, its facts and its findings, and says SOLID / MIXED / SHAKY, so you can see which files need checking.

**Verified:** 49 browser checks pass (4 new: suggestions, no repeats, grouped chips, evidence meter, wide notes column).

## 2026-11-02 · No hover tricks, stamps in line

**Done**
- Removed every hover-only behaviour: no redaction bars on facts (plain text + stamp), board labels always visible
  (the "labels" switch is gone; click a label to cut it), no hover dimming or card lift on the board,
  edit/delete on findings and × on connections always shown.
- **Facts:** each stamp sits straight on the same line as its label (e.g. `LAUNCHED [VERIFIED]`), value below.
- **Findings** (page + case-file sidebar): each stamp sits straight on the same line as its time.
- The file title keeps its big stamp on the right.

**Verified:** 53 browser checks pass, incl. labels visible without hover, no redaction, fact and finding stamps level with their label/time.

## 2026-11-02 · Connections as red threads

**Problem:** connection pills turned into lumpy blobs when a name wrapped onto two lines.

**Done:** each relation is now a small red thread. The relation name and a count sit on top ("DRIVEN BY · 2"),
and each connected file hangs off the thread on its own line, with × to disconnect. Long names wrap as plain text,
and the thread ends at the last file.

**Verified:** 53 browser checks pass; checked in light and night shift.

## 2026-11-02 · Comments on every case file

**Done**
- Every case file has a **Comments** section at the bottom of the folder, oldest first, with a count.
- Write in the box: **Enter** posts, **Shift+Enter** adds a new line.
- Each comment has a 🗑 **bin**. Deleting shows "Comment deleted · UNDO" for 5 seconds, and undo puts it back in the same place.
- Comments are searchable from the top bar and included in backups.
- Comments live only in the case file. Board cards stay clean.

**Verified:** 63 browser checks pass (posting, line breaks, bin, undo, search, backup, HTML escaping).

## 2026-11-02 · Removed the evidence bar

Took the evidence meter (SOLID / MIXED / SHAKY bar) off the case file. The stamps already say how sure each item is.

## 2026-11-02 · Ideas as red strings

**Problem:** the ideas page was a standard kanban.

**Done**
- Each idea is one row: name, the gap it closes, what it **ties** together (its connected files), and one **next move** you can edit inline.
- Progress is a **red string** with 4 knots: proposed → prototyping → pitched → accepted. The string is red up to where the idea is; click any knot to move it. Accepted turns green.
- Rows are sorted by how far along they are, so the closest-to-pitch idea is on top.
- The heading counts live ideas and how many are pitched or accepted.
- **drop** folds an idea into a collapsed "Dropped" list, and **revive** brings it back.
- Removed the old kanban code and styles.

**Verified:** 12 new checks; full suite passes (desktop + phone, light + night shift).

## 2026-11-11 · Knowledge first: Files home, Map side feature, no dates

**Problem:** the corkboard as the main page gets cluttered as files grow, and dates added clutter without value.

**Done**
- **Files is the home page:** every file as a clean card, grouped by type, with summary, stamp and
  connection/finding counts. Filter, type chips, sort (A–Z / recently edited / most connected), + new file.
  The old "drawer" list is gone; a case file opened without a name returns to Files.
- **Map replaces the corkboard (side page):** one file in the centre, only its direct connections around it on
  red strings with relation tags, laid out automatically. Click a file to walk the string to it (animated),
  a trail shows the path back, and "start from" picks any file. Phones get a hanging two-column layout.
  It always shows one neighbourhood, so it never gets cluttered. No dragging or manual pinning.
- **No dates anywhere:** removed from findings, comments, case header, search results and footer.
- Case file: "pin to board" became "◎ view on map".
- Removed the board code and styles.

**Verified:** 63 browser checks pass: every page, map walking/trail/picker, no overlapping map cards
(desktop and phone), no date stamps or time elements on any page, HTML escaping, backup → reset → restore,
no sideways scroll on phones, 0 console errors.
