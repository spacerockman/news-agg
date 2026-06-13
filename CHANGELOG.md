# Changelog

## [0.4.1] - 2026-06-13

### Fixed
- **CNN short-URL date resolution**: cnn.it links now resolved → real URL → date extracted
- **36氪 date format**: `2026-06-13 14:00:00 +0800` → normalized to ISO before parsing
- **Removed non-RSS CN feeds**: 香港01, 德国之声 return HTML pages, not RSS

### Changed
- AGENTS.md Rule #11: auto-push to GitHub after every change

---

## [0.4.0] - 2026-06-13

### Added
- **JP native-language feeds**: Yahoo JP (4 categories), Livedoor — Japanese titles now display in 日本語
- **CN independent feeds**: 36氪, SCMP, 香港01, 德国之声 — no government/state media
- Per-article `lang` field (ja/en/zh) for native language display
- Response item cap (500 max) to prevent crashes on large datasets
- Git version control with `.opencode/` auto-context for AI agents

### Removed
- **All Chinese state media**: 人民网 ×5, CGTN, China Daily, Sixth Tone, People's Daily English
- **Global Chinese translation** (translateTitles) — savings: ~¥0.004/refresh
- Lang toggle now controls UI only (categories, labels), not title translation

### Changed
- CN time-filter back to 12h (was unlimited — to exclude stale state media)
- AI dedup prompt: now handles multilingual (EN/JA/ZH) cross-language matching
- AI dedup: pick verbatim original title instead of AI-generated short text

---

## [0.3.0] - 2026-06-13

### Added
- **CN news sources**: China Daily, SCMP, CGTN, Sixth Tone, People's Daily (5 feeds)
- **CN filter button** with 🇨🇳 flag
- **Drag-to-reorder** country filter tags (order persists in localStorage)
- **iPhone access** via local network IP (server binds `0.0.0.0`)
- **Safari Reader mode hint** (⌘⇧R) in footer
- **Quiet hours**: auto-refresh paused between 2AM-10AM
- **AGENTS.md** for AI-readable project context
- **CHANGELOG.md** for version tracking
- **.gitignore** (excludes `server.log`, `node_modules`)

### Changed
- Refresh interval: 10 minutes → 8 hours (cost optimization)
- Cache duration: 5 minutes → 8 hours
- Country filter keys: 1-4 → 1-5 (now includes CN)
- Keyboard "0" now shows all countries (was scroll hint)
- Footer: simplified to key shortcuts + Reader hint + drag hint

### Fixed
- CDATA `<link>` parsing for feeds like China Daily (previously returned 0 articles)
- Translation API 400 error: added "JSON" keyword to system prompt (required by DeepSeek `response_format`)
- AI dedup JSON truncation: increased `max_tokens` from 2048 → 8192
- Duplicate `translateTitles` function causing "Illegal return statement" syntax error

---

## [0.2.0] - 2026-06-13

### Added
- **Chinese translation** of all headlines + categories via DeepSeek
- Progressive loading: raw articles (2s) → AI-deduped (10s) → translated (15s)
- Frontend polling for AI/translation readiness
- Language toggle button (中/En) with localStorage persistence

### Fixed
- "Invalid Date" display on CNN articles without `<pubDate>` → `--:--` fallback
- Date extraction from CNN URLs (`04-03-23` format)
- Category badge overflow ("Entertainment" too wide for column)

### Changed
- Port: 3456 → 18180

---

## [0.1.0] - 2026-06-13

### Added
- Initial implementation
- RSS fetching from 21 news feeds (US 6, UK 5, AU 5, JP 5)
- AI dedup via DeepSeek Flash (`deepseek-chat` model)
- White minimalist terminal-style UI with category badges
- Country filter buttons (ALL, US, UK, AU, JP)
- Keyboard shortcuts (r refresh, 1-4 filter, k toggle cat)
- 12-hour time window filter for articles
- Token-optimized AI prompts (title truncation, batch processing)
- launchd background service with auto-start
- `run.sh` management script
