import { createServer } from "http";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import os from "os";

const PORT = 18180;
const CONFIG_PATH = `${process.env.HOME}/.config/opencode/opencode.json`;
const CACHE_DURATION = 8 * 60 * 60 * 1000;
const TIME_WINDOW = 12 * 60 * 60 * 1000;
const BATCH_SIZE = 100;
const __dirname = dirname(fileURLToPath(import.meta.url));

function parseJSONC(text) {
  return JSON.parse(text.replace(/,\s*([\]}])/g, "$1"));
}

function loadDeepSeekConfig() {
  const raw = readFileSync(CONFIG_PATH, "utf-8");
  const config = parseJSONC(raw);
  const p = config.provider.deepseek;
  return {
    apiKey: p.options.apiKey,
    baseURL: p.options.baseURL,
    model: "deepseek-chat",
  };
}

const DEEPSEEK = loadDeepSeekConfig();

const FEEDS = [
  { url: "http://rss.cnn.com/rss/edition.rss", source: "CNN", country: "US" },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", source: "NYT", country: "US" },
  { url: "https://feeds.npr.org/1001/rss.xml", source: "NPR", country: "US" },
  { url: "https://rssfeeds.usatoday.com/usatoday-NewsTopStories", source: "USA Today", country: "US" },
  { url: "https://moxie.foxnews.com/google-publisher/world.xml", source: "Fox News", country: "US" },
  { url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", source: "MarketWatch", country: "US" },

  { url: "https://feeds.bbci.co.uk/news/rss.xml", source: "BBC", country: "UK" },
  { url: "https://www.theguardian.com/world/rss", source: "Guardian", country: "UK" },
  { url: "https://feeds.skynews.com/feeds/rss/world.xml", source: "Sky News", country: "UK" },
  { url: "https://www.independent.co.uk/news/rss", source: "Independent", country: "UK" },
  { url: "https://www.telegraph.co.uk/rss.xml", source: "Telegraph", country: "UK" },

  { url: "https://www.abc.net.au/news/feed/51120/rss.xml", source: "ABC News", country: "AU" },
  { url: "https://www.smh.com.au/rss/feed.xml", source: "SMH", country: "AU" },
  { url: "https://www.news.com.au/content-feeds/latest-news/", source: "news.com.au", country: "AU" },
  { url: "https://www.9news.com.au/rss", source: "9News", country: "AU" },
  { url: "https://www.ntnews.com.au/content-feeds/latest-news/", source: "NT News", country: "AU" },

  { url: "https://www.japantimes.co.jp/feed/", source: "Japan Times", country: "JP", lang: "ja" },
  { url: "https://japantoday.com/feed", source: "Japan Today", country: "JP", lang: "ja" },
  { url: "https://mainichi.jp/rss/etc/mainichi-en.rss", source: "Mainichi", country: "JP", lang: "ja" },
  { url: "https://soranews24.com/feed/", source: "SoraNews24", country: "JP", lang: "ja" },
  { url: "https://www.tokyoreporter.com/feed/", source: "Tokyo Reporter", country: "JP", lang: "ja" },

  { url: "https://news.yahoo.co.jp/rss/categories/domestic.xml", source: "Yahoo JP", country: "JP", lang: "ja" },
  { url: "https://news.yahoo.co.jp/rss/categories/world.xml", source: "Yahoo JP World", country: "JP", lang: "ja" },
  { url: "https://news.yahoo.co.jp/rss/categories/it.xml", source: "Yahoo JP IT", country: "JP", lang: "ja" },
  { url: "https://news.yahoo.co.jp/rss/categories/business.xml", source: "Yahoo JP Biz", country: "JP", lang: "ja" },
  { url: "https://news.livedoor.com/topics/rss/top.xml", source: "Livedoor", country: "JP", lang: "ja" },

  { url: "https://www.scmp.com/rss/4/feed", source: "SCMP", country: "CN", lang: "en" },
  { url: "https://36kr.com/feed", source: "36氪", country: "CN", lang: "zh" },
];

let rawCache = null;
let finalCache = null;
let loading = false;

function extract(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = re.exec(xml);
  if (!m) return "";
  let c = m[1].trim();
  const cd = c.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cd) c = cd[1].trim();
  return c.replace(/<[^>]+>/g, "");
}

function extractLink(item) {
  const re = /<link(?:[^>]*)>([\s\S]*?)<\/link>/i;
  const m = re.exec(item);
  if (!m) return "";
  let c = m[1].trim();
  const cd = c.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cd) c = cd[1].trim();
  return c;
}

function extractDate(item) {
  let raw = (
    extract(item, "pubDate") ||
    extract(item, "dc:date") ||
    extract(item, "published") ||
    ""
  );
  if (raw) raw = raw.replace(/(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})/, "$1T$2");
  return raw;
}

function extractDateFromURL(link) {
  const m1 = link.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}T12:00:00Z`;
  const m2 = link.match(/-(\d{2})-(\d{2})-(\d{2})/);
  if (m2) return `20${m2[3]}-${m2[1]}-${m2[2]}T12:00:00Z`;
  return "";
}

function parseRSS(xml, source, country, lang = "en") {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi);
  if (!items) return [];
  return items.map(item => {
    const title = extract(item, "title");
    const link = extractLink(item);
    const pubDate = extractDate(item) || extractDateFromURL(link);
    const rssCat = extract(item, "category");
    const desc = extract(item, "description");
    return { title, link, pubDate, source, country, rssCat, lang, desc };
  }).filter(a => a.title && a.link);
}

function timeFilter(articles) {
  const cutoff = Date.now() - TIME_WINDOW;
  return articles.filter(a => {
    const d = new Date(a.pubDate);
    return isNaN(d.getTime()) || d.getTime() > cutoff;
  });
}

function truncate(str, len = 80) {
  return str.length > len ? str.slice(0, len) + "…" : str;
}

function countryFlag(code) {
  const map = { US: "us", UK: "gb", AU: "au", JP: "jp", CN: "cn" };
  return map[code] || code.toLowerCase();
}

async function fetchFeed(feed) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(feed.url, {
      headers: { "User-Agent": "NewsAgg/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRSS(xml, feed.source, feed.country, feed.lang);
  } catch {
    return [];
  }
}

async function fetchAllFeeds() {
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const articles = [];
  for (const r of results) {
    if (r.status === "fulfilled") articles.push(...r.value);
  }
  return timeFilter(await resolveMissingDates(articles));
}

async function resolveMissingDates(articles) {
  const missing = articles.filter(a => !a.pubDate && a.link);
  if (missing.length === 0) return articles;
  const resolved = await Promise.allSettled(
    missing.map(async (a) => {
      try {
        const res = await fetch(a.link, {
          method: "HEAD",
          redirect: "follow",
          headers: { "User-Agent": "NewsAgg/1.0" },
          signal: AbortSignal.timeout(5000),
        });
        const date = extractDateFromURL(res.url);
        if (date) return { ...a, pubDate: date };
      } catch {}
      return a;
    })
  );
  const fixed = new Map(resolved.filter(r => r.status === "fulfilled").map(r => [r.value.link, r.value]));
  return articles.map(a => fixed.get(a.link) || a);
}

async function callDeepSeek(articles) {
  const input = articles.map((a, i) => ({
    id: i,
    title: truncate(a.title),
    source: a.source,
    country: a.country,
  }));

  const systemPrompt = `You are a news deduplicator. Given articles (titles may be in English, Japanese, or Chinese), group those covering the same story — cross-language merge when possible.

Input: array of {id,title,source,country}

Return JSON with exactly two keys:
- "groups": array of merged stories (when 2+ articles cover the same story)
  each: {"title":"pick the best original title verbatim","ids":[0,1],"category":"World"}
- "standalone": array of articles that DON'T merge with any other
  each: {"id":5,"category":"Politics"}

Every article must appear in EITHER groups or standalone, not both.
Every article must get a category.
Categories: World Politics Business Tech Science Health Sports Entertainment
Return ONLY valid JSON. No explanation. No markdown.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(`${DEEPSEEK.baseURL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK.apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(input) },
        ],
        response_format: { type: "json_object" },
        max_tokens: 8192,
        temperature: 0,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const errText = await res.text();
      console.error("DeepSeek API error:", res.status, errText.slice(0, 200));
      return null;
    }
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content;
    if (!text) return null;
    const cleaned = text.replace(/^```(?:json)?\s*|```\s*$/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e1) {
      try { parsed = JSON.parse(cleaned + '"}'); } catch {}
      try {
        const lastBrace = cleaned.lastIndexOf('}');
        const fixed = lastBrace > 0 ? cleaned.slice(0, lastBrace) + '}]}' : cleaned;
        parsed = JSON.parse(fixed);
      } catch {}
    }
    if (parsed) return parsed;
    return null;
  } catch (err) {
    console.error("DeepSeek call failed:", err.message);
    return null;
  }
}

function buildResponse(articles, aiResult) {
  const now = new Date();
  const updatedAt = now.toLocaleTimeString("en-US", { hour12: false });
  const totalRaw = articles.length;
  const ts = Date.now();

  if (!aiResult) {
    const items = articles.slice(0, 100).map(a => ({
      id: crypto.randomUUID(),
      title: a.title,
      desc: a.desc || "",
      link: a.link,
      pubDate: a.pubDate,
      source: a.source,
      country: countryFlag(a.country),
      lang: a.lang || "en",
      category: a.rssCat || "World",
      type: "standalone",
      sources: [a.source],
      countryFlags: [countryFlag(a.country)],
      unique: true,
      merged: false,
    }));
    return { items, updatedAt, totalRaw, merged: 0, aiStatus: "unavailable", ts };
  }

  const used = new Set();
  const items = [];

  for (const g of aiResult.groups || []) {
    const groupArticles = g.ids.map(i => articles[i]).filter(Boolean);
    if (groupArticles.length === 0) continue;
    groupArticles.forEach(a => used.add(a));
    const sorted = groupArticles.sort(
      (a, b) => new Date(b.pubDate) - new Date(a.pubDate)
    );
    const uniqueSources = [...new Set(groupArticles.map(a => a.source))];
    const uniqueFlags = [...new Set(groupArticles.map(a => countryFlag(a.country)))];
    items.push({
      id: crypto.randomUUID(),
      title: g.title,
      link: sorted[0].link,
      pubDate: sorted[0].pubDate,
      source: sorted[0].source,
      country: sorted[0].country.toLowerCase(),
      lang: sorted[0].lang || "en",
      category: g.category || "World",
      type: "merged",
      sources: uniqueSources,
      countryFlags: uniqueFlags,
      unique: uniqueSources.length === 1 && uniqueFlags.length === 1,
      merged: uniqueSources.length > 1,
    });
  }

  for (const sa of aiResult.standalone || []) {
    const a = articles[sa.id];
    if (!a || used.has(a)) continue;
    used.add(a);
    items.push({
      id: crypto.randomUUID(),
      title: a.title,
      link: a.link,
      pubDate: a.pubDate,
      source: a.source,
      country: countryFlag(a.country),
      lang: a.lang || "en",
      category: sa.category || a.rssCat || "World",
      type: "standalone",
      sources: [a.source],
      countryFlags: [countryFlag(a.country)],
      unique: true,
      merged: false,
    });
  }

  const remaining = articles.filter(a => !used.has(a));
  for (const a of remaining.slice(0, 20)) {
    items.push({
      id: crypto.randomUUID(),
      title: a.title,
      link: a.link,
      pubDate: a.pubDate,
      source: a.source,
      country: countryFlag(a.country),
      lang: a.lang || "en",
      category: a.rssCat || "World",
      type: "standalone",
      sources: [a.source],
      countryFlags: [countryFlag(a.country)],
      unique: true,
      merged: false,
    });
  }

  items.sort((a, b) => {
    const ta = new Date(a.pubDate).getTime();
    const tb = new Date(b.pubDate).getTime();
    const va = isNaN(ta) ? Date.now() : ta;
    const vb = isNaN(tb) ? Date.now() : tb;
    return vb - va;
  });
  const mergedCount = items.filter(i => i.merged).length;
  return { items: items.slice(0, 500), updatedAt, totalRaw, merged: mergedCount, aiStatus: "ok", ts };
}

async function refreshCache() {
  if (loading) return;
  loading = true;
  console.error("Refreshing news cache...");
  try {
    const articles = await fetchAllFeeds();
    console.error(`Fetched ${articles.length} articles from RSS`);

    rawCache = buildResponse(articles, null);
    rawCache.aiReady = false;

    let aiResult = null;
    if (articles.length > 0) {
      const batches = [];
      for (let i = 0; i < articles.length; i += BATCH_SIZE) {
        batches.push(articles.slice(i, i + BATCH_SIZE));
      }
      const results = await Promise.allSettled(batches.map(b => callDeepSeek(b)));
      const groups = [];
      const standalones = [];
      let offset = 0;
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          for (const g of r.value.groups || []) {
            g.ids = g.ids.map(id => id + offset);
            groups.push(g);
          }
          for (const s of r.value.standalone || []) {
            s.id += offset;
            standalones.push(s);
          }
        }
        offset += BATCH_SIZE;
      }
      aiResult = (groups.length > 0 || standalones.length > 0)
        ? { groups, standalone: standalones }
        : null;
    }
    finalCache = buildResponse(articles, aiResult);
    finalCache.aiReady = true;

    console.error(`Cache ready: ${finalCache.items.length} items (${finalCache.merged} merged)`);
  } catch (err) {
    console.error("Cache refresh failed:", err.message);
  } finally {
    loading = false;
  }
}

function getNews() {
  if (finalCache && Date.now() - finalCache.ts < CACHE_DURATION) {
    return finalCache;
  }
  if (finalCache) {
    refreshCache();
    return finalCache;
  }
  if (rawCache) {
    if (Date.now() - rawCache.ts > CACHE_DURATION) {
      refreshCache();
    }
    return rawCache;
  }
  return null;
}

const html = readFileSync(`${__dirname}/index.html`, "utf-8");

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const json = (body, code = 200) => {
    const s = JSON.stringify(body);
    res.writeHead(code, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(s);
  };

  if (url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  if (url.pathname === "/api/news") {
    const data = getNews();
    if (!data) {
      json({ loading: true });
      return;
    }
    json(data);
    return;
  }

  if (url.pathname === "/api/refresh") {
    refreshCache();
    return json({ ok: true });
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  const nets = os.networkInterfaces();
  let ip = "127.0.0.1";
  for (const name of Object.keys(nets)) {
    for (const iface of nets[name]) {
      if (iface.family === "IPv4" && !iface.internal) { ip = iface.address; break; }
    }
    if (ip !== "127.0.0.1") break;
  }
  console.log(`\x1b[32m✦ News Feed running at http://localhost:${PORT}\x1b[0m`);
  console.log(`\x1b[36m  iPhone: http://${ip}:${PORT}\x1b[0m`);
  console.log(`\x1b[2m  Press Ctrl+C to stop\x1b[0m`);
  refreshCache();
});
