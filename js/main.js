/**
 * GAMEHUB 游戏整合站 - 主逻辑
 * 路由管理 | 页面渲染 | 星空背景 | 交互处理
 */

// ===== 星空背景 =====
(function initStarfield() {
  const canvas = document.getElementById('starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let stars = [];
  const STAR_COUNT = 180;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createStars() {
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 0.4,
        opacity: Math.random(),
        twinkleSpeed: Math.random() * 0.015 + 0.003,
        twinkleDir: Math.random() > 0.5 ? 1 : -1
      });
    }
  }

  function drawStars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const star of stars) {
      star.opacity += star.twinkleSpeed * star.twinkleDir;
      if (star.opacity >= 1) { star.opacity = 1; star.twinkleDir = -1; }
      if (star.opacity <= 0.05) { star.opacity = 0.05; star.twinkleDir = 1; }

      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180, 220, 255, ${star.opacity})`;
      ctx.fill();

      if (star.r > 1.3) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 212, 255, ${star.opacity * 0.12})`;
        ctx.fill();
      }
    }
    requestAnimationFrame(drawStars);
  }

  window.addEventListener('resize', () => { resize(); createStars(); });
  resize();
  createStars();
  drawStars();
})();

// ===== 工具函数 =====
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatNumber(n) {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

function getRankClass(index) {
  if (index === 0) return 'gold';
  if (index === 1) return 'silver';
  if (index === 2) return 'bronze';
  return 'normal';
}

function getRankEmoji(index) {
  if (index === 0) return '🥇';
  if (index === 1) return '🥈';
  if (index === 2) return '🥉';
  return index + 1;
}

function getBadgeClass(category) {
  const map = {
    '攻略': 'badge-guide', '资讯': 'badge-info', '评测': 'badge-review',
    '动作': 'badge-action', '射击': 'badge-fps', '角色扮演': 'badge-rpg',
    '益智': 'badge-moba', '格斗': 'badge-action', '冒险': 'badge-rpg',
    '竞速': 'badge-fps', '体育': 'badge-moba', '策略': 'badge-info'
  };
  return map[category] || 'badge-guide';
}

// ===== 文章数据合并（静态 + 本地存储） =====
function getAllArticles() {
  try {
    const localArticles = JSON.parse(localStorage.getItem('gamehub_articles') || '[]');
    const localIds = new Set(localArticles.map(a => a.id));
    // 静态文章 + 本地文章，本地优先覆盖
    const staticFiltered = ARTICLES_DATA.filter(a => !localIds.has(a.id));
    return [...staticFiltered, ...localArticles];
  } catch(e) {
    return ARTICLES_DATA;
  }
}

// ===== 路由管理 =====
let currentGameId = null;
let currentArticleId = null;
const scrollPositions = {}; // 记录每个页面的滚动位置

function navigate(route, params) {
  if (route === 'game-detail' && params) {
    currentGameId = params;
    window.location.hash = '#game/' + params;
  } else if (route === 'guide-detail' && params) {
    currentArticleId = params;
    window.location.hash = '#guide/' + params;
  } else {
    window.location.hash = '#' + route;
  }
}

function parseHash() {
  const hash = window.location.hash.slice(1) || 'home';
  if (hash.startsWith('game/')) return { route: 'game-detail', id: parseInt(hash.split('/')[1]) };
  if (hash.startsWith('guide/')) return { route: 'guide-detail', id: parseInt(hash.split('/')[1]) };
  return { route: hash };
}

function handleRoute() {
  const { route, id } = parseHash();

  // 保存当前页面滚动位置
  const prevRoute = document.querySelector('.page.active')?.id.replace('page-', '') || 'home';
  // 修正 game-detail -> game-detail, guide-detail -> guide-detail
  let prevKey = prevRoute;
  if (prevRoute === 'game-detail') prevKey = 'game-detail';
  if (prevRoute === 'guide-detail') prevKey = 'guide-detail';
  scrollPositions[prevKey] = window.scrollY;

  // 1. 先移除所有页面的 active，触发淡出
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.remove('active');
    const r = a.dataset.route;
    if (r === route || (route === 'game-detail' && r === 'games') || (route === 'guide-detail' && r === 'guides')) {
      a.classList.add('active');
    }
  });

  document.querySelector('.nav-links').classList.remove('open');

  // 2. 渲染新页面内容
  switch (route) {
    case 'home': renderHome(); break;
    case 'games': renderGames(); break;
    case 'game-detail': renderGameDetail(id); break;
    case 'guides': renderGuides(); break;
    case 'guide-detail': renderGuideDetail(id); break;
    default: renderHome();
  }

  updatePageTitle(route, id);

  // 3. 恢复滚动位置：详情页始终滚到顶部，列表页恢复之前的位置
  if (route === 'game-detail' || route === 'guide-detail') {
    window.scrollTo(0, 0);
  } else {
    window.scrollTo(0, scrollPositions[route] || 0);
  }

  // 4. 下一帧添加 active，触发 CSS transition 淡入动画
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const pageMap = {
        'home': 'page-home',
        'games': 'page-games',
        'game-detail': 'page-game-detail',
        'guides': 'page-guides',
        'guide-detail': 'page-guide-detail'
      };
      const pageId = pageMap[route] || 'page-home';
      const pageEl = document.getElementById(pageId);
      if (pageEl) pageEl.classList.add('active');
    });
  });
}

function updatePageTitle(route, id) {
  let title = 'GAMEHUB - 游戏整合站';
  let desc = '发现、下载、畅玩 —— 你的游戏资源中心';

  if (route === 'games') { title = '游戏大厅 - GAMEHUB'; desc = '浏览全部怀旧游戏，按分类筛选经典游戏。'; }
  else if (route === 'game-detail' && id) {
    const g = GAMES_DATA.find(x => x.id === id);
    if (g) { title = g.name + ' - GAMEHUB'; desc = g.desc; }
  }
  else if (route === 'guides') { title = '攻略中心 - GAMEHUB'; desc = '热门游戏攻略 · 通关秘籍'; }
  else if (route === 'guide-detail' && id) {
    const a = getAllArticles().find(x => x.id === id);
    if (a) { title = a.title + ' - GAMEHUB'; desc = a.summary; }
  }

  document.title = title;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', desc);
}

// ===== 首页 =====
function renderHome() {
  const page = document.getElementById('page-home');

  const hotGames = GAMES_DATA.filter(g => g.rating >= 4).slice(0, 6);

  page.innerHTML = `
    <section class="hero">
      <h1 class="hero-title">游戏整合站</h1>
      <p class="hero-subtitle">发现、下载、畅玩 —— 你的游戏资源中心</p>
      <div class="hero-actions">
        <button class="btn-primary" onclick="navigate('games')">🎮 浏览游戏</button>
      </div>
    </section>

    <div style="margin-bottom: 14px;">
      <h2 class="section-title">快速入口</h2>
      <p class="section-subtitle">选择你的目的地</p>
    </div>
    <div class="quick-access">
      <div class="quick-card" onclick="navigate('games')">
        <span class="quick-card-icon">🎮</span>
        <h3 class="quick-card-title">游戏大厅</h3>
        <p class="quick-card-desc">${GAMES_DATA.length}+ 款经典游戏</p>
      </div>
      <div class="quick-card" onclick="navigate('guides')">
        <span class="quick-card-icon">📖</span>
        <h3 class="quick-card-title">游戏攻略</h3>
        <p class="quick-card-desc">通关秘籍 · 技巧分享</p>
      </div>
    </div>

    <h2 class="section-title">热门推荐</h2>
    <p class="section-subtitle">玩家最爱的经典游戏</p>
    <div class="game-grid">
      ${hotGames.map(g => `
        <div class="game-card" onclick="navigate('game-detail', ${g.id})">
          <img class="game-card-cover" src="${g.cover}" alt="${g.name}" loading="lazy" onerror="this.style.background='var(--bg-secondary)';this.alt='暂无封面';">
          <div class="game-card-body">
            <div class="game-card-name">${escapeHtml(g.name)}</div>
            <span class="game-card-link">进入游戏 ↗</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ===== 游戏大厅 =====
function renderGames() {
  const page = document.getElementById('page-games');

  const filteredGames = GAMES_DATA;

  page.innerHTML = `
    <h2 class="section-title">游戏大厅</h2>
    <p class="section-subtitle">共 ${filteredGames.length} 款游戏</p>

    <div class="search-bar">
      <input type="text" class="search-input" id="game-search" placeholder="搜索游戏名称..." oninput="handleGameSearch(this.value)">
      <button class="search-btn" onclick="document.getElementById('game-search').value='';handleGameSearch('');">重置</button>
    </div>

    <div class="game-grid" id="game-grid">
      ${filteredGames.length === 0 ? `
        <div class="no-results" style="grid-column:1/-1;">
          <p class="no-results-title">未找到游戏</p>
          <p>没有找到匹配的游戏</p>
        </div>
      ` : filteredGames.map(g => `
        <div class="game-card" onclick="navigate('game-detail', ${g.id})">
          <img class="game-card-cover" src="${g.cover}" alt="${g.name}" loading="lazy" onerror="this.style.background='var(--bg-secondary)';this.alt='暂无封面';">
          <div class="game-card-body">
            <div class="game-card-name">${escapeHtml(g.name)}</div>
            <span class="game-card-link">进入游戏 ↗</span>
          </div>
        </div>
      `).join('')}
    </div>

    ${filteredGames.length > 0 ? `<p class="load-state">已加载全部 ${filteredGames.length} 款游戏</p>` : ''}
  `;
}

function handleGameSearch(query) {
  const grid = document.getElementById('game-grid');
  if (!grid) return;
  const cards = grid.querySelectorAll('.game-card');
  const q = query.toLowerCase().trim();
  cards.forEach(card => {
    const name = card.querySelector('.game-card-name').textContent.toLowerCase();
    card.style.display = (!q || name.includes(q)) ? '' : 'none';
  });
  const visible = Array.from(cards).filter(c => c.style.display !== 'none');
  const loadState = grid.parentElement.querySelector('.load-state');
  if (loadState) loadState.textContent = '已加载全部 ' + visible.length + ' 款游戏';
  const existingNoResults = grid.querySelector('.no-results');
  if (visible.length === 0 && !existingNoResults) {
    const nr = document.createElement('div');
    nr.className = 'no-results';
    nr.style.gridColumn = '1/-1';
    nr.innerHTML = '<p class="no-results-title">未找到游戏</p><p>没有找到匹配的游戏</p>';
    grid.appendChild(nr);
  } else if (visible.length > 0 && existingNoResults) {
    existingNoResults.remove();
  }
}

// ===== 游戏详情 =====
function renderGameDetail(id) {
  const page = document.getElementById('page-game-detail');
  const game = GAMES_DATA.find(g => g.id === id);

  if (!game) {
    page.innerHTML = `
      <button class="btn-back" onclick="navigate('games')">← 返回游戏大厅</button>
      <div class="error-state"><p>游戏不存在</p><p>游戏未找到</p></div>
    `;
    return;
  }

  const related = GAMES_DATA.filter(g => g.category === game.category && g.id !== game.id).slice(0, 4);

  page.innerHTML = `
    <button class="btn-back" onclick="navigate('games')">← 返回游戏大厅</button>
    <div class="game-detail">
      <img class="game-detail-cover" src="${game.cover}" alt="${game.name}" onerror="this.style.background='var(--bg-secondary)';this.alt='暂无封面';">
      <div class="game-detail-info">
        <h1 class="game-detail-name">${escapeHtml(game.name)}</h1>
        <p class="game-detail-desc">${escapeHtml(game.desc)}</p>
        <div class="game-detail-specs">
          <div class="game-detail-spec"><div class="game-detail-spec-label">平台</div><div class="game-detail-spec-value">${escapeHtml(game.platform)}</div></div>
          <div class="game-detail-spec"><div class="game-detail-spec-label">发行年份</div><div class="game-detail-spec-value">${game.year}</div></div>
          <div class="game-detail-spec"><div class="game-detail-spec-label">分类</div><div class="game-detail-spec-value">${escapeHtml(game.category)}</div></div>
        </div>
        <a href="${game.url}" target="_blank" rel="noopener noreferrer" class="btn-download">前往官网下载 ↗</a>
      </div>
    </div>
    ${related.length > 0 ? `
      <h2 class="section-title">同类游戏推荐</h2>
      <p class="section-subtitle">你可能也喜欢这些游戏</p>
      <div class="game-grid">
        ${related.map(g => `
          <div class="game-card" onclick="navigate('game-detail', ${g.id})">
            <img class="game-card-cover" src="${g.cover}" alt="${g.name}" loading="lazy" onerror="this.style.background='var(--bg-secondary)';this.alt='暂无封面';">
            <div class="game-card-body">
              <div class="game-card-name">${escapeHtml(g.name)}</div>
              <span class="game-card-link">进入游戏 ↗</span>
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;
}

// ===== 攻略列表 =====
function renderGuides() {
  const page = document.getElementById('page-guides');

  page.innerHTML = `
    <h2 class="section-title">攻略中心</h2>
    <p class="section-subtitle">热门游戏攻略 · 通关秘籍</p>

    <div class="search-bar">
      <input type="text" class="search-input" id="article-search" placeholder="搜索攻略文章..." oninput="handleArticleSearch(this.value)">
      <button class="search-btn" onclick="document.getElementById('article-search').value='';handleArticleSearch('');">重置</button>
    </div>

    <div class="article-list" id="article-list">
      ${getAllArticles().map(a => {
        const tags = [a.category];
        return `
          <div class="article-card" onclick="navigate('guide-detail', ${a.id})">
            <div class="article-badge ${getBadgeClass(a.category)}">${escapeHtml(a.category)}</div>
            <div class="article-card-body">
              <h3 class="article-card-title">${escapeHtml(a.title)}</h3>
              <p class="article-card-summary">${escapeHtml(a.summary)}</p>
              <div class="article-card-meta">
                <span>${escapeHtml(a.author)}</span>
                <span>${a.date}</span>
                <span>👁 ${formatNumber(a.views)}</span>
                <span class="article-card-tags">${tags.map(t => '<span class="article-card-tag">' + escapeHtml(t) + '</span>').join('')}</span>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function handleArticleSearch(query) {
  const list = document.getElementById('article-list');
  if (!list) return;
  const cards = list.querySelectorAll('.article-card');
  const q = query.toLowerCase().trim();
  cards.forEach(card => {
    const title = card.querySelector('.article-card-title').textContent.toLowerCase();
    const summary = card.querySelector('.article-card-summary').textContent.toLowerCase();
    card.style.display = (!q || title.includes(q) || summary.includes(q)) ? '' : 'none';
  });
}

// ===== 攻略详情 =====
function renderGuideDetail(id) {
  const page = document.getElementById('page-guide-detail');
  const article = getAllArticles().find(a => a.id === id);

  if (!article) {
    page.innerHTML = `
      <button class="btn-back" onclick="navigate('guides')">← 返回攻略列表</button>
      <div class="error-state"><p>文章不存在</p><p>文章未找到</p></div>
    `;
    return;
  }

  const moreArticles = getAllArticles().filter(a => a.id !== article.id).slice(0, 3);

  page.innerHTML = `
    <button class="btn-back" onclick="navigate('guides')">← 返回攻略列表</button>
    <div class="article-detail">
      <img class="article-detail-cover" src="${article.cover}" alt="${article.title}" onerror="this.style.background='var(--bg-secondary)';this.alt='暂无封面';">
      <h1 class="article-detail-title">${escapeHtml(article.title)}</h1>
      <div class="article-detail-meta">
        <span>👤 ${escapeHtml(article.author)}</span>
        <span>📅 ${article.date}</span>
        <span>👁 ${formatNumber(article.views)} 阅读</span>
        <span class="article-badge ${getBadgeClass(article.category)}">${escapeHtml(article.category)}</span>
      </div>
      <div class="article-detail-content">${article.content}</div>
    </div>
    ${moreArticles.length > 0 ? `
      <div style="margin-top:40px;">
        <h2 class="section-title">更多攻略</h2>
        <p class="section-subtitle">继续阅读更多精彩内容</p>
        <div class="article-list">
          ${moreArticles.map(a => `
            <div class="article-card" onclick="navigate('guide-detail', ${a.id})">
              <div class="article-badge ${getBadgeClass(a.category)}">${escapeHtml(a.category)}</div>
              <div class="article-card-body">
                <h3 class="article-card-title">${escapeHtml(a.title)}</h3>
                <p class="article-card-summary">${escapeHtml(a.summary)}</p>
                <div class="article-card-meta">
                  <span>${escapeHtml(a.author)}</span>
                  <span>${a.date}</span>
                  <span>👁 ${formatNumber(a.views)}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

// ===== 移动端菜单 =====
function toggleMobileMenu() {
  document.querySelector('.nav-links').classList.toggle('open');
}

// ===== 初始化 =====
function init() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
  document.addEventListener('click', (e) => {
    const nav = document.querySelector('.nav-links');
    const toggle = document.querySelector('.nav-toggle');
    if (nav && nav.classList.contains('open') && !nav.contains(e.target) && !toggle.contains(e.target)) {
      nav.classList.remove('open');
    }
  });
}

document.addEventListener('DOMContentLoaded', init);