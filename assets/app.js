// Requires: auth.js loaded first (sets window.CL.supabase)
const PAGE_SIZE = 20;
let currentOffset = 0;
let currentCategory = 'all';
let currentTag = null;
let isLoading = false;
let hasMore = true;

const STRINGS = {
  en: {
    timeJustNow: 'just now',
    timeHAgo: h => `${h}h ago`,
    timeDayAgo: d => `${d}d ago`,
    todayTop: "Today's Top Signal",
    trendingTags: 'Trending Tags',
    weeklySignal: 'Free Weekly Signal',
    weeklyDesc: 'Top 10 stories every Monday. No spam.',
    subFree: 'Subscribe Free',
    sponsored: 'Sponsored',
    loadMore: 'Load more',
    signIn: 'Sign In',
    signOut: 'Sign Out',
    marketPulse: 'MARKET PULSE',
    basedOn: (n, time) => `Based on ${n} signals · ${time}`,
    histLabel: '14-DAY HISTORY',
    today: 'Today',
    sentiment: { bullish: 'BULLISH', bearish: 'BEARISH', neutral: 'NEUTRAL', mixed: 'MIXED' },
    liveLabel: () => 'XAU/USD · SPOT',
    priceSnapshot: 'Metals',
  },
  zh: {
    timeJustNow: '刚刚',
    timeHAgo: h => `${h}小时前`,
    timeDayAgo: d => `${d}天前`,
    todayTop: '今日热点',
    trendingTags: '热门标签',
    weeklySignal: '每周免费信号',
    weeklyDesc: '每周一推送10条精选，不发垃圾邮件。',
    subFree: '免费订阅',
    sponsored: '赞助',
    loadMore: '加载更多',
    signIn: '登录',
    signOut: '退出',
    marketPulse: '市场脉搏',
    basedOn: (n, time) => `基于 ${n} 条信号 · ${time}`,
    histLabel: '14天历史',
    today: '今日',
    sentiment: { bullish: '看多', bearish: '看空', neutral: '中性', mixed: '混合' },
    liveLabel: () => 'XAU/USD · 现货',
    priceSnapshot: '金属',
  }
};

function getLang() { return localStorage.getItem('lens_lang') || 'zh'; }
function t(key, ...args) {
  const s = STRINGS[getLang()][key];
  return typeof s === 'function' ? s(...args) : (s ?? key);
}
function setLang(lang) {
  localStorage.setItem('lens_lang', lang);
  applyLangToDOM();
  loadFeed(true);
  loadTodaysTop();
  loadMarketPulse();
}
function toggleLang() { setLang(getLang() === 'zh' ? 'en' : 'zh'); }
function applyLangToDOM() {
  const lang = getLang();
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const s = STRINGS[lang][key];
    if (s && typeof s === 'string') el.textContent = s;
  });
  const toggle = document.getElementById('lang-toggle');
  if (toggle) toggle.textContent = lang === 'zh' ? 'EN' : '中';
}

const CAT_BADGE_CLASS = {
  gold: 'badge-cat-gold', silver: 'badge-cat-silver',
  oil: 'badge-cat-oil', macro: 'badge-cat-macro', ai: 'badge-cat-ai'
};

function scoreClass(score) {
  if (score >= 9) return 'score-pro';
  if (score >= 8) return 'score-high';
  return 'score-mid';
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return t('timeJustNow');
  if (h < 24) return t('timeHAgo', h);
  return t('timeDayAgo', Math.floor(h / 24));
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function renderEditorNote(article) {
  if (article.editor_note) {
    return `
      <div class="editor-note-wrap">
        <div class="editor-note-label">Editor's Take</div>
        <div class="editor-note">${escapeHtml(article.editor_note)}</div>
      </div>`;
  }
  if (article.is_pro && !window.CL.isPro()) {
    return `
      <div class="editor-note-wrap">
        <div class="editor-note-label">Editor's Take</div>
        <div class="paywall-blur">
          <div class="editor-note" style="filter:blur(4px);user-select:none;">
            This analysis covers key market implications and strategic context
            for investors monitoring this development closely.
          </div>
          <div class="paywall-cta">
            <span>Pro only —</span>
            <a href="subscribe.html">Upgrade</a>
          </div>
        </div>
      </div>`;
  }
  return '';
}

function renderCard(article, isTop) {
  const catClass = CAT_BADGE_CLASS[article.category] || 'badge-cat-gold';
  const tags = (article.tags || []).slice(0, 4).map(tag =>
    `<span class="tag" onclick="filterByTag('${escapeHtml(tag)}')">#${escapeHtml(tag)}</span>`
  ).join('');
  const url = escapeHtml(article.original_url || '#');
  const summary = getLang() === 'zh' ? (article.summary_zh || article.summary || '') : (article.summary || '');

  return `
    <div class="card ${isTop ? 'top-card' : ''} ${article.is_pro ? 'pro-card' : ''}"
         onclick="openArticle('${url}')">
      <div class="card-meta">
        <span class="card-source">${escapeHtml(article.source_name || 'Unknown')} · ${timeAgo(article.published_at)}</span>
        <div class="card-badges">
          <span class="badge ${catClass}">${escapeHtml(article.category || 'gold')}</span>
          <span class="score-badge ${scoreClass(article.importance_score)}">●${escapeHtml(String(article.importance_score ?? 7))}</span>
        </div>
      </div>
      <a class="card-title" href="${url}" target="_blank"
         rel="noopener" onclick="event.stopPropagation()">
        ${escapeHtml(article.title)}
      </a>
      <p class="card-summary">${escapeHtml(summary)}</p>
      ${tags ? `<div class="card-tags">${tags}</div>` : ''}
      ${renderEditorNote(article)}
    </div>`;
}

async function loadTodaysTop() {
  const sb = window.CL.supabase;
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data } = await sb
    .from('metal_articles')
    .select('*')
    .gte('published_at', since)
    .gte('importance_score', 8)
    .order('importance_score', { ascending: false })
    .limit(5);

  const container = document.getElementById('top-grid');
  if (!container) return;
  if (!data?.length) { container.closest('.top-section')?.classList.add('hidden'); return; }
  container.innerHTML = data.map(a => renderCard(a, true)).join('');
}

async function loadFeed(reset) {
  if (isLoading || (!hasMore && !reset)) return;
  if (reset) { currentOffset = 0; hasMore = true; }
  isLoading = true;
  const sb = window.CL.supabase;

  let q = sb.from('metal_articles').select('*')
    .order('importance_score', { ascending: false })
    .order('published_at', { ascending: false });
  if (currentCategory !== 'all') q = q.eq('category', currentCategory);
  if (currentTag) q = q.contains('tags', [currentTag]);
  q = q.range(currentOffset, currentOffset + PAGE_SIZE - 1);

  let data;
  try {
    const res = await q;
    data = res.data;
  } catch (e) {
    isLoading = false;
    return;
  }
  isLoading = false;

  if (!data?.length) { hasMore = false; _hideLoadMore(); return; }
  if (data.length < PAGE_SIZE) { hasMore = false; _hideLoadMore(); }

  const container = document.getElementById('feed');
  if (!container) return;
  if (reset) container.innerHTML = '';
  container.insertAdjacentHTML('beforeend', data.map(a => renderCard(a, false)).join(''));
  currentOffset += data.length;
}

function _hideLoadMore() {
  document.getElementById('load-more-btn')?.closest('.load-more')?.classList.add('hidden');
}

function setCategory(cat) {
  currentCategory = cat;
  currentTag = null;
  document.querySelectorAll('.nav-filter').forEach(el => {
    el.classList.toggle('active', el.dataset.cat === cat);
  });
  loadFeed(true);
}

function filterByTag(tag) {
  currentTag = tag;
  currentCategory = 'all';
  document.querySelectorAll('.nav-filter').forEach(el => el.classList.remove('active'));
  loadFeed(true);
}

function openArticle(url) {
  if (url && url !== '#') window.open(url, '_blank', 'noopener');
}

async function loadSidebarTags() {
  const sb = window.CL.supabase;
  const { data } = await sb.from('metal_articles').select('tags').limit(100);
  const counts = {};
  (data || []).forEach(a => (a.tags || []).forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; }));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const container = document.getElementById('sidebar-tags');
  if (!container) return;
  container.innerHTML = top.map(([tag]) =>
    `<span class="tag" onclick="filterByTag('${escapeHtml(tag)}')">#${escapeHtml(tag)}</span>`
  ).join('');
}

async function handleSubscribe(email) {
  if (!email || !email.includes('@')) return { error: 'Invalid email' };
  const sb = window.CL.supabase;
  const { error } = await sb.from('subscribers').insert({ email });
  return { error };
}

async function loadMarketPulse() {
  const sb = window.CL.supabase;
  const { data } = await sb
    .from('metal_pulses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  const container = document.getElementById('pulse-card');
  const hero = document.getElementById('pulse-hero');
  if (!container) return;

  if (!data?.length) {
    container.innerHTML = '<p class="pulse-empty">Market pulse will appear after the next fetch cycle.</p>';
    return;
  }

  const latest  = data[0];
  const sentKey = ['bullish','bearish','neutral','mixed'].includes(latest.sentiment) ? latest.sentiment : 'neutral';
  const sign    = latest.sentiment_score > 0 ? '+' : '';
  const themes  = (latest.key_themes || []).map(th => `<span class="tag">#${escapeHtml(th)}</span>`).join('');
  if (hero) hero.className = `pulse-hero pulse-${sentKey}`;

  const byDay = {};
  data.forEach(r => {
    const day = (r.created_at || '').slice(0, 10);
    if (!day) return;
    if (!byDay[day]) byDay[day] = { scores: [], sentiments: [] };
    byDay[day].scores.push(Number(r.sentiment_score) || 0);
    byDay[day].sentiments.push(r.sentiment || 'neutral');
  });
  const days = Object.keys(byDay).sort().slice(-14).map(day => {
    const scores = byDay[day].scores;
    const avg    = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const cnt    = {};
    byDay[day].sentiments.forEach(s => { cnt[s] = (cnt[s] || 0) + 1; });
    const sentiment = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
    return { day, score: avg, sentiment };
  });

  const COLOR    = { bullish:'#00c896', bearish:'#ff4757', neutral:'#ffd32a', mixed:'#a29bfe' };
  const maxScore = Math.max(...days.map(d => Math.abs(d.score)), 1);
  const bars = days.map(d => {
    const c  = COLOR[d.sentiment] || '#ffd32a';
    const h  = Math.max(Math.round((Math.abs(d.score) / maxScore) * 100), 4);
    const op = Math.min(0.4 + Math.abs(d.score) / 100 * 0.6, 1.0).toFixed(2);
    return `<div class="hist-bar" style="height:${h}%;background:${c};opacity:${op}"></div>`;
  }).join('');
  const firstDay = days[0]?.day
    ? new Date(days[0].day + 'T12:00:00Z').toLocaleDateString('en', { month: 'short', day: 'numeric' })
    : '';

  container.innerHTML = `
    <div class="pulse-hero-meta">
      <span class="pulse-label">${t('marketPulse')}</span>
      <span class="pulse-time">${t('basedOn', escapeHtml(String(latest.article_count || '?')), timeAgo(latest.created_at))}</span>
    </div>
    <div class="pulse-hero-sentiment">
      <span class="pulse-hero-mood">${t('sentiment')[sentKey] || sentKey.toUpperCase()}</span>
      <span class="pulse-hero-score">${sign}${escapeHtml(String(latest.sentiment_score))}</span>
    </div>
    <p class="pulse-hero-en">${escapeHtml(latest.summary_en)}</p>
    ${themes ? `<div class="pulse-hero-themes">${themes}</div>` : ''}
    ${days.length > 0 ? `
    <div class="hero-hist-bars">
      <div class="hist-label">${t('histLabel')}</div>
      <div class="hist-bars">${bars}</div>
      <div class="hist-dates"><span>${firstDay}</span><span>${t('today')}</span></div>
    </div>` : ''}`;
}

window.toggleLang = toggleLang;
window.applyLangToDOM = applyLangToDOM;
window.setCategory = setCategory;
window.filterByTag = filterByTag;
window.openArticle = openArticle;
window.handleSubscribe = handleSubscribe;
window.loadFeed = loadFeed;
window.loadTodaysTop = loadTodaysTop;
window.loadSidebarTags = loadSidebarTags;
window.loadMarketPulse = loadMarketPulse;

/* ── HOURLY CHART (forex candle) ── */
let _hourlyChartTimer = null;

function fmtK(p) {
  return p >= 1000 ? '$' + (p / 1000).toFixed(1) + 'k' : '$' + p.toFixed(2);
}

function renderHourlyChart(closes) {
  const W = 380, H = 88;
  const PL = 4, PR = 44, PT = 12, PB = 8;
  const plotW = W - PL - PR;
  const plotH = H - PT - PB;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const pad = (max - min) * 0.15 || min * 0.005;
  const lo = min - pad, hi = max + pad;
  const scaleY = plotH / (hi - lo);
  const toY = p => PT + plotH - (p - lo) * scaleY;
  const n = closes.length;
  const step = plotW / Math.max(n - 1, 1);
  const pts = closes.map((p, i) => ({ x: PL + i * step, y: toY(p) }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const fillD = pathD + ` L${pts[pts.length-1].x.toFixed(1)},${(PT+plotH).toFixed(1)} L${PL},${(PT+plotH).toFixed(1)} Z`;
  const lx = pts[pts.length-1].x.toFixed(1);
  const ly = pts[pts.length-1].y.toFixed(1);
  const hiY = toY(max).toFixed(1);
  const loY = toY(min).toFixed(1);
  const ax = W - PR + 5;
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:88px;display:block">
  <defs>
    <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#c9a84c" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#c9a84c" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <line x1="${PL}" y1="${(PT+plotH*0.25).toFixed(1)}" x2="${W-PR}" y2="${(PT+plotH*0.25).toFixed(1)}" stroke="rgba(255,255,255,0.04)" stroke-dasharray="4,3"/>
  <line x1="${PL}" y1="${(PT+plotH*0.60).toFixed(1)}" x2="${W-PR}" y2="${(PT+plotH*0.60).toFixed(1)}" stroke="rgba(255,255,255,0.04)" stroke-dasharray="4,3"/>
  <line x1="${W-PR}" y1="${PT}" x2="${W-PR}" y2="${(PT+plotH).toFixed(1)}" stroke="rgba(201,168,76,0.12)" stroke-width="1"/>
  <path d="${fillD}" fill="url(#hg)"/>
  <path d="${pathD}" fill="none" stroke="#c9a84c" stroke-width="1.8" stroke-linejoin="round"/>
  <circle cx="${lx}" cy="${ly}" r="3.5" fill="#c9a84c" stroke="rgba(0,0,0,0.5)" stroke-width="1.5"/>
  <circle cx="${lx}" cy="${ly}" r="7" fill="none" stroke="#c9a84c" stroke-width="1" opacity="0.3"/>
  <text x="${ax}" y="${(parseFloat(hiY)+8).toFixed(1)}" font-size="7" fill="rgba(201,168,76,0.65)" font-family="JetBrains Mono,monospace">${fmtK(max)}</text>
  <text x="${ax}" y="${(parseFloat(loY)-2).toFixed(1)}" font-size="7" fill="rgba(201,168,76,0.45)" font-family="JetBrains Mono,monospace">${fmtK(min)}</text>
</svg>`;
}

const _GOLD_HIST_KEY = 'ml_gold_hist';
const _GOLD_HIST_MAX = 240; // 240 × 15s = 1 hour of data

function _addGoldHistory(price) {
  try {
    const hist = JSON.parse(localStorage.getItem(_GOLD_HIST_KEY) || '[]');
    hist.push(price);
    if (hist.length > _GOLD_HIST_MAX) hist.splice(0, hist.length - _GOLD_HIST_MAX);
    localStorage.setItem(_GOLD_HIST_KEY, JSON.stringify(hist));
    return hist;
  } catch { return [price]; }
}

async function loadHourlyChart() {
  const el = document.getElementById('gold-chart');
  if (!el) return;
  try {
    const hist = JSON.parse(localStorage.getItem(_GOLD_HIST_KEY) || '[]');
    if (hist.length < 2) {
      el.innerHTML = '<div style="height:88px;display:flex;align-items:center;justify-content:center;opacity:0.3;font-size:11px">Chart builds as data arrives…</div>';
      return;
    }
    const sb = window.CL.supabase;
    const { data: pulses } = await sb
      .from('metal_pulses')
      .select('sentiment_score, sentiment')
      .order('created_at', { ascending: false })
      .limit(12);

    const COLOR = { bullish:'#00c896', bearish:'#ff4757', neutral:'#ffd32a', mixed:'#a29bfe' };
    const band = pulses?.length ? '<div class="sent-band">' +
      [...pulses].reverse().map(p => {
        const c  = COLOR[p.sentiment] || '#ffd32a';
        const op = Math.min(0.4 + Math.abs(p.sentiment_score || 0) / 100 * 0.6, 1.0).toFixed(2);
        return `<div class="sb-seg" style="background:${c};opacity:${op}"></div>`;
      }).join('') + '</div>' : '';

    const span = hist.length < 20 ? `${hist.length * 15}s` : hist.length < 240 ? `${Math.round(hist.length / 4)}m` : '1h';
    el.innerHTML = renderHourlyChart(hist) + band +
      `<div class="chart-foot"><span>${span} ago</span><span style="color:rgba(255,255,255,0.1)">▓ sentiment</span><span>now</span></div>`;
  } catch (e) {
    console.warn('[loadHourlyChart]', e.message);
  }
}

/* ── GOLD PRICE POLL (REST only — forex WS requires paid Finnhub plan) ── */
let _lastGoldPrice = null;

function updateGoldPrice(price, pct) {
  const priceEl = document.getElementById('gold-price');
  const chgEl   = document.getElementById('gold-chg');
  if (!priceEl) return;

  if (_lastGoldPrice !== null) {
    priceEl.style.color = price > _lastGoldPrice ? '#c9a84c' : price < _lastGoldPrice ? '#ff4757' : '';
    setTimeout(() => { if (priceEl) priceEl.style.color = ''; }, 800);
  }
  _lastGoldPrice = price;
  priceEl.textContent = '$' + price.toFixed(2);

  if (pct !== null && pct !== undefined) {
    const sign = pct >= 0 ? '▲ +' : '▼ ';
    if (chgEl) { chgEl.textContent = sign + Math.abs(pct).toFixed(2) + '%'; chgEl.style.color = pct >= 0 ? '#c9a84c' : '#ff4757'; }
  }
}

function setLiveStatus() {
  const ring  = document.getElementById('live-ring');
  const label = document.getElementById('live-status');
  if (ring)  ring.style.background = 'rgba(201,168,76,0.6)';
  if (label) label.textContent = t('liveLabel')();
}

function initGoldPricePoll() {
  setLiveStatus();
  loadHourlyChart();

  async function fetchSpot() {
    try {
      const r = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xau.json');
      const d = await r.json();
      const ozUsd = d?.xau?.usd;
      if (!ozUsd) return;
      const priceEl = document.getElementById('gold-price');
      if (priceEl) {
        if (_lastGoldPrice !== null) {
          priceEl.style.color = ozUsd > _lastGoldPrice ? '#c9a84c' : ozUsd < _lastGoldPrice ? '#ff4757' : '';
          setTimeout(() => { if (priceEl) priceEl.style.color = ''; }, 800);
        }
        _lastGoldPrice = ozUsd;
        priceEl.textContent = '$' + ozUsd.toFixed(0);
      }
      _addGoldHistory(ozUsd);
      loadHourlyChart();
    } catch (e) { console.warn('[XAU spot]', e.message); }
  }

  async function pollChange() {
    try {
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=GLD&token=${FINNHUB_API_KEY}`);
      const d = await r.json();
      if (d.dp != null) {
        const chgEl = document.getElementById('gold-chg');
        if (chgEl) {
          const sign = d.dp >= 0 ? '▲ +' : '▼ ';
          chgEl.textContent = sign + Math.abs(d.dp).toFixed(2) + '%';
          chgEl.style.color = d.dp >= 0 ? '#c9a84c' : '#ff4757';
        }
        const rangeEl = document.getElementById('gold-range');
        if (rangeEl && d.h && d.l)
          rangeEl.textContent = `GLD Day Low $${d.l.toFixed(2)} · High $${d.h.toFixed(2)}`;
      }
    } catch (e) { console.warn('[GLD poll]', e.message); }
  }

  fetchSpot();
  pollChange();
  setInterval(fetchSpot, 3600000);
  setInterval(pollChange, 15000);
}

window.loadHourlyChart = loadHourlyChart;
window.initGoldPricePoll = initGoldPricePoll;

/* ── METALS PRICE SNAPSHOT (ETF proxies — Finnhub free tier) ── */
const SNAPSHOT_SYMS = ['GLD','SLV','USO','PPLT','CPER'];
const SNAPSHOT_DISPLAY = { 'GLD':'XAU', 'SLV':'XAG', 'USO':'OIL', 'PPLT':'XPT', 'CPER':'XCU' };
const SNAPSHOT_META    = { 'GLD':'Gold', 'SLV':'Silver', 'USO':'Brent', 'PPLT':'Platinum', 'CPER':'Copper' };
let _priceSnapshotTimer = null;
const _SNAP_HIST_KEY = 'ml_snap_hist';
const _SNAP_HIST_MAX = 30;

function _addSnapHistory(sym, price) {
  try {
    const all = JSON.parse(localStorage.getItem(_SNAP_HIST_KEY) || '{}');
    if (!all[sym]) all[sym] = [];
    all[sym].push(price);
    if (all[sym].length > _SNAP_HIST_MAX) all[sym].splice(0, all[sym].length - _SNAP_HIST_MAX);
    localStorage.setItem(_SNAP_HIST_KEY, JSON.stringify(all));
    return all[sym];
  } catch { return [price]; }
}

function _sparkPoints(prices) {
  if (!prices?.length || prices.length < 2) return '';
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || prices[0] * 0.001;
  return prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * 50;
    const y = 18 - ((p - min) / range) * 16;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

async function loadPriceSnapshot() {
  const el = document.getElementById('price-snapshot-block');
  if (!el) return;
  try {
    const quotesArr = await Promise.all(
      SNAPSHOT_SYMS.map(s =>
        fetch(`https://finnhub.io/api/v1/quote?symbol=${s}&token=${FINNHUB_API_KEY}`).then(r => r.json())
      )
    );

    const snapHist = JSON.parse(localStorage.getItem(_SNAP_HIST_KEY) || '{}');
    const rows = SNAPSHOT_SYMS.map((sym, i) => {
      const q    = quotesArr[i] || {};
      if (q.c) _addSnapHistory(sym, q.c);
      const hist  = snapHist[sym] || [];
      const pts   = _sparkPoints(hist);
      const pct   = q.dp ?? 0;
      const up    = pct >= 0;
      const color = up ? '#c9a84c' : '#ff4757';
      const sign  = up ? '+' : '';
      return `<div class="price-row">
        <div>
          <div class="pr-sym">${SNAPSHOT_DISPLAY[sym]}</div>
          <div class="pr-name">${SNAPSHOT_META[sym]}</div>
        </div>
        <svg class="pr-spark" viewBox="0 0 52 20" preserveAspectRatio="none">
          ${pts ? `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>` : ''}
        </svg>
        <div>
          <div class="pr-price">$${(q.c ?? 0).toFixed(2)}</div>
          <div class="pr-chg" style="color:${color}">${sign}${pct.toFixed(2)}%</div>
        </div>
      </div>`;
    }).join('');

    el.innerHTML = `<div class="sidebar-title">${t('priceSnapshot')} <span class="live-badge-sm">~30s</span></div>${rows}`;
    el.style.display = '';
  } catch { el.style.display = 'none'; }
  if (_priceSnapshotTimer) clearTimeout(_priceSnapshotTimer);
  _priceSnapshotTimer = setTimeout(loadPriceSnapshot, 30000);
}

window.loadPriceSnapshot = loadPriceSnapshot;
