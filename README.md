# redstring

A private, single-user evidence board for learning ISSQUARED's product portfolio.
Files (products, concepts, competitors, trends, ideas, people, sources) are pinned to a
corkboard, tied together with typed strings, and stamped VERIFIED / INFERRED / ACTIVE LEAD.

**Rule:** public sources only. No internal docs, code, customer names or credentials, ever.

## What it does
| Page | You can |
|---|---|
| **Board** | drag cards · pin new cards (button or double-click the cork) · tie strings (🧵 mode) · cut strings (click a label) · filter by type |
| **Case files** | browse/filter the drawer · open a file · write markdown notes (autosave) · edit facts · stamp it · connect files · log findings · comment (🗑 bin with undo) |
| **Findings** | write a finding · tag files (picker or `[[Name]]`) · stamp · filter · edit · delete |
| **Ideas** | one row per idea · click a knot on its red string to move it (proposed → prototyping → pitched → accepted) · see what it ties together · keep a next move · drop / revive |
| **Everywhere** | search everything (`/`) · jot a finding (`N`) · night shift · backup / restore / reset (footer) |

Notes support `# headings`, `- lists`, `- [ ] tasks`, `**bold**`, `*italic*`, `` `code` ``,
`==highlight==`, `> quotes`, `[text](https://…)` and `[[File name]]` links. A link to a
file that doesn't exist yet offers to open it.

## Where data lives
In **this browser** (localStorage), so it works on Vercel with no server.
Use **backup** in the footer often: it downloads a JSON file, and **restore** loads it back.
Data does not sync between browsers or devices yet. That comes with the FastAPI + PostgreSQL backend,
which only needs `static/js/store.js` swapped for API calls.

## Layout
```
index.html / cases.html / findings.html / ideas.html   page shells
static/js/store.js      data: entities, links, findings, search, backup (swap for API later)
static/js/ui.js         header, footer, search, modals, toasts, markdown, quick jot
static/js/board.js      board interactions
static/js/cases.js      drawer + case file editor
static/js/findings.js   findings log
static/js/ideas.js      ideas pipeline
static/css/redstring.css  theme
vercel.json, robots.txt   static hosting, noindex
docs/LOG.md             build log
```
