/**
 * GAMEHUB 攻略预渲染构建脚本
 * -------------------------------------------------
 * 目的：解决 SPA + hash 路由导致攻略页无法被搜索引擎收录的问题。
 * 为 data/articles.js 中的每一篇攻略生成独立的、服务端渲染完成的
 * 静态 HTML 页面（article/{id}.html），正文直接烘焙进 HTML，
 * 爬虫无需执行 JS 即可读取完整内容。同时重建 sitemap.xml，
 * 只包含可索引的真实 URL（去掉 # 锚点）。
 *
 * 用法：node scripts/build-articles.js
 * 部署时在发布工单 workflow 中同样调用，保证新增/修改文章后自动同步。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://mengchen.me';
const OUT_DIR = path.join(ROOT, 'article');
const TODAY = new Date().toISOString().slice(0, 10);

// ===== 1. 解析数据文件（自维护数据，使用 Function 取值） =====
function loadJsArray(rel, keyword) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const start = src.indexOf(keyword);
  if (start === -1) throw new Error(rel + ' 中找不到 ' + keyword);
  let open = src.indexOf('[', start);
  // 找到匹配的闭合 ]
  let depth = 0, end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
  }
  const arrText = src.slice(open, end + 1);
  // eslint-disable-next-line no-new-func
  return new Function('return (' + arrText + ');')();
}

const articles = loadJsArray('data/articles.js', 'ARTICLES_DATA');
const games = loadJsArray('data/games.js', 'GAMES_DATA');
const gameById = {};
games.forEach(g => { gameById[g.id] = g; });

// ===== 2. 工具 =====
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// 正文内相对资源路径从站点根 -> 当前 article/ 子目录
function fixRel(src) {
  return String(src || '')
    .replace(/src=["']assets\/([^"']+)["']/g, 'src="../assets/$1"')
    .replace(/href=["']assets\/([^"']+)["']/g, 'href="../assets/$1"');
}

// ===== 3. 目录清理与准备 =====
fs.mkdirSync(OUT_DIR, { recursive: true });

// ===== 4. 生成每篇攻略页面 =====
function renderHeader(currentTitle) {
  return `
<header class="seo-topbar">
  <a class="seo-brand" href="/">GAMEHUB</a>
  <nav class="seo-nav">
    <a href="/#games">游戏大厅</a>
    <a href="/#guides">攻略中心</a>
  </nav>
</header>`;
}

function renderFooter() {
  return `
<footer class="seo-footer">
  <a href="/">首页</a>
  <a href="/#guides">攻略中心</a>
  <a href="https://mengchen.me" rel="noopener">GAMEHUB 游戏整合站</a>
</footer>`;
}

const sitemapUrls = [];

articles.forEach((a, idx) => {
  const game = a.gameId ? gameById[a.gameId] : null;
  const url = SITE + '/article/' + a.id + '.html';
  const canonical = url;
  sitemapUrls.push({
    loc: url,
    lastmod: a.date && /^\d{4}-\d{2}-\d{2}$/.test(a.date) ? a.date : TODAY,
    priority: '0.8'
  });

  // 封面与正文内资源路径修正
  const cover = a.cover ? a.cover.replace(/^assets\//, '../assets/') : '';
  const contentHtml = fixRel(a.content);

  // 相关阅读：同游戏其他文章优先
  const related = articles
    .filter(x => x.gameId === a.gameId && x.id !== a.id)
    .concat(articles.filter(x => x.gameId !== a.gameId).sort((m, n) => (n.views || 0) - (m.views || 0)))
    .slice(0, 3);

  const relatedHtml = related.length
    ? `<h2 class="seo-related-title">更多攻略</h2>
       <div class="seo-related-list">
       ${related.map(r => `
         <a class="seo-related-item" href="/article/${r.id}.html">
           <span class="seo-related-cat">${esc(r.category || '攻略')}</span>
           <span class="seo-related-name">${esc(r.title)}</span>
         </a>`).join('')}
       </div>`
    : '';

  const breadcrumb = game
    ? `<nav class="seo-breadcrumb"><a href="/">首页</a><span>/</span><a href="/#guides">攻略</a><span>/</span><span>${esc(game.name)}</span></nav>`
    : `<nav class="seo-breadcrumb"><a href="/">首页</a><span>/</span><a href="/#guides">攻略</a></nav>`;

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(a.title)} - GAMEHUB 游戏攻略</title>
<meta name="description" content="${esc(a.summary || '')}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(a.title)}">
<meta property="og:description" content="${esc(a.summary || '')}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="GAMEHUB 游戏整合站">
<link rel="stylesheet" href="../css/style.css">
<style>
  .seo-topbar{position:sticky;top:0;z-index:100;background:#fff;border-bottom:1px solid var(--border,#e3e8f2);display:flex;align-items:center;justify-content:space-between;padding:14px 20px}
  .seo-topbar .seo-brand{font-weight:700;color:var(--primary,#2456c8);letter-spacing:1px}
  .seo-nav{display:flex;gap:18px}
  .seo-nav a{color:var(--text-secondary,#4a5674);font-size:14px}
  .seo-nav a:hover{color:var(--primary,#2456c8)}
  .seo-main{max-width:820px;margin:0 auto;padding:36px 20px 60px}
  .seo-breadcrumb{font-size:13px;color:var(--text-muted,#8a93ad);margin-bottom:22px}
  .seo-breadcrumb a{color:var(--text-muted,#8a93ad)}
  .seo-breadcrumb a:hover{color:var(--primary,#2456c8)}
  .seo-breadcrumb span{margin:0 8px}
  .seo-cat{display:inline-block;font-size:12px;color:#fff;background:var(--accent,#ff9d2e);border-radius:4px;padding:2px 10px;margin-bottom:14px}
  .seo-title{font-size:28px;font-weight:700;line-height:1.35;color:var(--text-primary,#1a2340);margin-bottom:14px}
  .seo-meta{font-size:13px;color:var(--text-muted,#8a93ad);display:flex;flex-wrap:wrap;gap:14px;margin-bottom:26px;border-bottom:1px solid var(--border,#e3e8f2);padding-bottom:20px}
  .seo-cover{width:100%;border-radius:10px;margin-bottom:26px}
  .seo-related-title{font-size:20px;margin:48px 0 16px;color:var(--text-primary,#1a2340)}
  .seo-related-list{display:grid;grid-template-columns:1fr;gap:10px}
  .seo-related-item{display:flex;align-items:center;gap:10px;padding:14px 16px;border:1px solid var(--border,#e3e8f2);border-radius:8px;background:#fff;transition:box-shadow .2s;color:var(--text-primary,#1a2340)}
  .seo-related-item:hover{box-shadow:0 4px 16px rgba(13,35,82,.08)}
  .seo-related-cat{flex:none;font-size:11px;color:#fff;background:var(--primary,#2456c8);border-radius:4px;padding:2px 8px}
  .seo-related-name{font-size:15px;font-weight:600}
  .seo-footer{text-align:center;padding:32px 20px;border-top:1px solid var(--border,#e3e8f2);background:#fff;font-size:13px;color:var(--text-muted,#8a93ad)}
  .seo-footer a{color:var(--text-muted,#8a93ad);margin:0 10px}
  .seo-footer a:hover{color:var(--primary,#2456c8)}
  .back-home{margin-bottom:20px}
  .back-home a{font-size:14px;color:var(--text-secondary,#4a5674)}
  .back-home a:hover{color:var(--primary,#2456c8)}
  @media (max-width:640px){
    .seo-title{font-size:22px}
    .seo-main{padding:24px 16px 48px}
    .seo-nav{gap:12px}
  }
</style>
</head>
<body>
${renderHeader(a.title)}
<main class="seo-main">
  ${breadcrumb}
  <div class="back-home"><a href="/#guides">← 返回攻略中心</a></div>
  <article itemscope itemtype="https://schema.org/Article">
    ${a.category ? `<span class="seo-cat">${esc(a.category)}</span>` : ''}
    <h1 class="seo-title" itemprop="headline">${esc(a.title)}</h1>
    <div class="seo-meta">
      <span>👤 ${esc(a.author || 'GAMEHUB攻略组')}</span>
      <span>📅 <time itemprop="datePublished">${esc(a.date || '')}</time></span>
      <span>👁 ${(a.views || 0).toLocaleString()} 阅读</span>
    </div>
    ${cover ? `<img class="seo-cover" src="${esc(cover)}" alt="${esc(a.title)}" loading="lazy">` : ''}
    <div class="article-detail-content" itemprop="articleBody">
${contentHtml}
    </div>
  </article>
  ${relatedHtml}
</main>
${renderFooter()}
</body>
</html>
`;

  fs.writeFileSync(path.join(OUT_DIR, a.id + '.html'), html);
  console.log('✅ 生成 ' + a.id + '.html 「' + a.title + '」');
});

// ===== 5. 重建 sitemap.xml（只含可索引真实 URL，去掉 # 锚点） =====
const homeLastmod = TODAY;
const sitemapItems = [
  { loc: SITE + '/', lastmod: homeLastmod, priority: '1.0' },
  ...sitemapUrls.slice().sort((a, b) => (a.priority === b.priority ? 0 : a.priority > b.priority ? -1 : 1))
];
// 首页放最前，攻略按日期新的靠前
sitemapItems.sort((a, b) => {
  if (a.loc === SITE + '/') return -1;
  if (b.loc === SITE + '/') return 1;
  return b.lastmod.localeCompare(a.lastmod);
});

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapItems.map(it => `  <url>
    <loc>${it.loc}</loc>
    <lastmod>${it.lastmod}</lastmod>
    <changefreq>${it.loc === SITE + '/' ? 'daily' : 'weekly'}</changefreq>
    <priority>${it.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);
console.log('✅ sitemap.xml 已重建，共 ' + sitemapItems.length + ' 条可索引 URL');