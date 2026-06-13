# News Aggregator — AI Agent Context

> Last updated: 2026-06-13 (v0.4.3)
> **⚠️ CRITICAL: After every change to this project, update this file and CHANGELOG.md.**
> opencode loads these via `.opencode/opencode.json` → `"instructions": ["AGENTS.md", "CHANGELOG.md"]`

This file is the authoritative source of truth about this project for any AI assistant.

## 1. WHAT THIS PROJECT IS

A **zero-dependency, single-page news aggregator** for macOS.  
Fetches RSS feeds from 28 news portals across 5 countries, deduplicates via DeepSeek Flash AI, and displays in a minimalist terminal-style white UI. Each country's news displays in its native language: JP in Japanese, CN in Chinese, EN for others. Runs as a `launchd` background service, accessible from Mac + iPhone on the same WiFi.

**Goal:** Maximum information density with minimum visual noise. AI-powered dedup removes duplicate stories. Native-like experience via Safari pinned tab.

**Absolute constraints:**
- Must work with only `node` (macOS or Homebrew). No npm install, no framework, no build step.
- DeepSeek API key is read from `~/.config/opencode/opencode.json` — never hardcoded.
- CSS and JS are inline in `index.html` — no external dependencies.
- Server binds `0.0.0.0:18180` so iPhone on same LAN can access.

---

## 2. FILE STRUCTURE

```
~/Desktop/news-agg/
  server.mjs          ← Node.js v26+ ESM server (entry point)
  index.html          ← Single-page frontend (HTML+CSS+JS, zero deps)
  run.sh              ← Management script (start/stop/status/install)
  com.newsfeed.server.plist  ← launchd config for auto-start on login
  server.log          ← Runtime logs (gitignored)
  .gitignore
  AGENTS.md           ← This file
  CHANGELOG.md        ← Version history
  README.md           ← User-facing docs
```

---

## 3. ARCHITECTURE

### Server (`server.mjs`)

```
on start → refreshCache() (async background)
            │
            ├─ Phase 1: fetchAllFeeds() → 26 RSS feeds (Promise.allSettled)
            │              └─ parseRSS() → regex-based XML parser (no DOMParser)
            │              └─ timeFilter() → keep only last 12h
            │              └─ buildResponse() → rawCache (100 articles, aiReady=false)
            │
            ├─ Phase 2: callDeepSeek(batch) → dedup articles
            │              └─ 3 parallel batches of ≤100 articles
            │              └─ model: deepseek-chat (→ deepseek-v4-flash)
            │              └─ 8192 max_tokens, temperature=0
            │
            ├─ Phase 3: translateTitles(titles) → Chinese translation
            │              └─ 3 parallel batches of 80 titles
            │              └─ model: deepseek-chat, response_format: json_object
            │
            └─ finalCache (aiReady=true, zhReady=true)

HTTP Routes:
  GET /              → serve index.html from memory
  GET /api/news      → return cache (raw if no finalCache, finalCache if ready)
  GET /api/refresh   → force cache refresh
  GET /api/open      → open original article URL in Safari
```

### Frontend (`index.html`)

```
Page load → load(true)
  ├─ GET /api/news
  │   ├─ {loading:true}   → show spinner, poll 2s
  │   ├─ {aiReady:false}  → render raw articles, poll 5s
  │   └─ {aiReady:true}   → render full articles, stop polling
  │
  ├─ renderFilters() → dynamic filter bar with drag-to-reorder
  │   └─ Order persisted in localStorage("newsFilterOrder")
  │
  ├─ renderArticles() → mixed timeline, sorted by pubDate desc
  │   └─ lang==="zh" && titleZh → show Chinese title
  │   └─ merged → show source list with "merged" badge
  │   └─ click title → /api/open original publisher URL in Safari
  │
  ├─ switchLang() → toggle en/zh, re-render everything
  │
  └─ Auto-refresh: every 8h, skip 2AM-10AM
```

### AI Pipeline

```
RSS feeds (28)
  → fetchAllFeeds (parseRSS regex)
  → timeFilter (12h window, all countries)
  → callDeepSeek (dedup: 3-5 batches, multilingual matching)
  → buildResponse (sort, merge sources, cap 500 items)
```

---

## 4. CURRENT RSS FEEDS (28 total)

| Country | Feeds |
|---------|-------|
| US (6)  | CNN, NYT, NPR, USA Today, Fox News, MarketWatch |
| UK (5)  | BBC, Guardian, Sky News, Independent, Telegraph |
| AU (5)  | ABC News, SMH, news.com.au, 9News, NT News |
| JP (10) | Japan Times, Japan Today, Mainichi, SoraNews24, Tokyo Reporter, Yahoo JP ×4, Livedoor |
| CN (4)  | SCMP, 36氪, 香港01, 德国之声 |

**Language mapping:** JP → ja, CN → zh/varies, US/UK/AU → en

**Policy:** NO Chinese state media (人民网, CGTN, China Daily, Xinhua, Global Times, etc.)

---

## 5. API DETAILS

### `GET /api/news` Response format:

```json
{
  "items": [{
    "id": "uuid",
    "title": "article title in native language",
    "link": "https://...",
    "pubDate": "ISO or RFC 2822",
    "source": "CNN",
    "country": "us",
    "lang": "en",
    "category": "World",
    "merged": true,
    "sources": ["CNN", "BBC"],
    "countryFlags": ["us", "gb"]
  }],
  "updatedAt": "14:30:22",
  "totalRaw": 275,
  "merged": 18,
  "aiStatus": "ok",
  "aiReady": true,
  "ts": 1718276400000,
  "zhReady": true
}
```

### DeepSeek API:

- Base URL: `https://api.deepseek.com/v1/chat/completions`
- Model: `deepseek-chat` (resolves to `deepseek-v4-flash`)
- Auth: `Bearer <key-from-opencode-config>`
- Dedup prompt (system): see `callDeepSeek()` in server.mjs
- Translation prompt (system): `"Translate each title to Chinese. Return ONLY JSON: {\"items\":[...]} in same order. No explanation."`
- Translation requires `response_format: { type: "json_object" }`
- **Important:** `response_format` of type `json_object` requires the word "JSON" in the prompt.

---

## 6. COST MODEL

| Operation | Tokens (est.) | Cost |
|-----------|--------------|------|
| AI dedup (5×100 articles) | ~16,000 | ~¥0.020 |
| **Per refresh total** | **~16,000** | **~¥0.020** |

At 3 refreshes/day (8h interval, quiet hours): ~¥1.80/month

---

## 7. HOW TO RUN

```bash
# Manual start
node ~/Desktop/news-agg/server.mjs

# Install as background service (starts on login)
bash ~/Desktop/news-agg/run.sh --install

# Management
bash ~/Desktop/news-agg/run.sh status
bash ~/Desktop/news-agg/run.sh stop
```

**Access:**  
- Mac: http://localhost:18180  
- iPhone (same WiFi): http://[Mac-IP]:18180

---

## 8. UI KEYBOARD SHORTCUTS

| Key | Action |
|-----|--------|
| `r` | Refresh now |
| `1-5` | Filter US/UK/AU/JP/CN |
| `0` | Show all countries |
| `k` | Toggle category visibility |
| click title | Open original article URL in Safari |

---

## 9. KNOWN ISSUES & TODO

- [ ] CN independent sources limited — most Chinese independent media lack RSS  
- [ ] 香港01, 德国之声 feeds may be unstable (CDATA format, geo-restrictions)  
- [ ] CNN feed serves mostly old articles; find alternative US source  
- [ ] Some RSS feeds may fail silently — no UI indicator  
- [ ] No error recovery when DeepSeek API is down (falls back to raw articles)  
- [ ] No unit tests  
- [ ] No dark mode toggle (user prefers white)  
- [ ] iPhone layout not optimized for mobile  

---

## 10. RULES FOR FUTURE AI AGENTS

1. **Read this file first** before making any changes.  
2. **Update this file** after every meaningful change — especially the feed list, architecture, known issues, and changelog.  
3. **Append to CHANGELOG.md** with date, version tag.  
4. **Never commit API keys** — they are read from `~/.config/opencode/opencode.json` at runtime.  
5. **Never add npm dependencies** — the project must remain zero-install. Use only Node.js built-ins.  
6. **Before editing server.mjs**, run `node --check` to validate syntax.  
7. **Before editing index.html, test key paths**: page loads, API call works, language toggle works, drag-to-reorder works.  
8. **port is 18180** — never change without updating launchd plist and this file.  
9. **Quiet hours: 2AM-10AM** — respect this when modifying refresh logic.  
10. **Cost constraint**: single refresh should stay under ¥0.02 (~12K tokens).  
11. **After every change, push to GitHub**: `git add -A && git commit -m "..." && git push`.  
