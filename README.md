# redstring

A private, single-user research notebook for learning ISSQUARED's product portfolio.
Every product, concept, competitor, trend, idea, person and source gets a **file**. Files are connected
with typed relations and stamped VERIFIED / INFERRED / ACTIVE LEAD.

**Rule:** public sources only. No internal docs, code, customer names or credentials, ever.

## Pages
| Page | What it's for |
|---|---|
| **Files** (home) | every file, grouped by type · filter · sort (A–Z, recently edited, most connected) · + new file |
| **Case file** | notes (markdown, autosave) · facts with stamps · connections · findings · comments (🗑 bin with undo) |
| **Findings** | quick research notes · tag files (picker or `[[Name]]`) · stamp · filter · edit · delete |
| **Ideas** | one row per idea · red-string progress (proposed → prototyping → pitched → accepted) · ties · next move |
| **Map** | side feature: one file in the middle, its connections around it · click to walk the string · trail back |
| **Everywhere** | search (`/`) · jot a finding (`N`) · night shift · backup / restore / reset (footer) |

No dates are shown anywhere: research stays about the content.

Notes support `# headings`, `- lists`, `- [ ] tasks`, `**bold**`, `*italic*`, `` `code` ``,
`==highlight==`, `> quotes`, `[text](https://…)` and `[[File name]]` links.

## Where data lives
In **this browser** (localStorage), so it works on Vercel with no server.
Use **backup** in the footer often: it downloads a JSON file, and **restore** loads it back.
Moving to FastAPI + PostgreSQL later only needs `static/js/store.js` swapped for API calls.

## Layout
```
index.html / cases.html / findings.html / ideas.html / map.html   page shells
static/js/store.js      data: files, connections, findings, comments, search, backup
static/js/ui.js         header, footer, search, modals, toasts, markdown, quick jot
static/js/files.js      Files home
static/js/cases.js      case file
static/js/findings.js   findings
static/js/ideas.js      ideas
static/js/map.js        map (follow the string)
static/css/redstring.css  theme
vercel.json, robots.txt   static hosting, noindex
docs/LOG.md             build log
```
