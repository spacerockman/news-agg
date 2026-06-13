# News Aggregator

Minimalist news reader for Mac & iPhone. AI-powered deduplication. Zero dependencies.

```
✦ News Feed running at http://localhost:18180
  iPhone: http://192.168.0.134:18180
```

## Quick Start

```bash
# Start manually
node ~/Desktop/news-agg/server.mjs

# Install as background service (auto-start on login)
bash ~/Desktop/news-agg/run.sh --install
```

Then open http://localhost:18180 in Safari → pin as tab.

## Features

- **26 RSS feeds** across US, UK, AU, JP, CN
- **AI dedup** via DeepSeek Flash — same stories merged, not duplicated
- **Chinese translation** — toggle 中/En button
- **White minimalist UI** — terminal aesthetic, text-only
- **iPhone access** — same WiFi, open Mac's IP:18180
- **8-hour auto-refresh** — quiet 2AM-10AM

## Keyboard

| Key | Action |
|-----|--------|
| `r` | Refresh |
| `1-5` | Filter country |
| `0` | Show all |
| `k` | Hide categories |
| `⌘⇧R` | Safari Reader |

## Manage Service

```bash
bash ~/Desktop/news-agg/run.sh status   # Check if running
bash ~/Desktop/news-agg/run.sh stop     # Stop service
bash ~/Desktop/news-agg/run.sh --install  # Reinstall
```

## Cost

~¥0.017 per refresh. ~¥1.50/month at 3x/day.
