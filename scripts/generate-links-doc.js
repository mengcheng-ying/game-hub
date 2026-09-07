/**
 * GAMEHUB 游戏链接表生成器
 * -----------------------------------------
 * 从 data/games.js 读取 GAMES_DATA，自动生成 LINKS.md。
 * LINKS.md 是给你查看和跟踪用的，所有修改仍以 data/games.js 为准。
 *
 * 用法：node scripts/generate-links-doc.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'data/games.js'), 'utf8');

const start = src.indexOf('GAMES_DATA');
if (start === -1) throw new Error('data/games.js 中找不到 GAMES_DATA');
let open = src.indexOf('[', start);
let depth = 0, end = -1;
for (let i = open; i < src.length; i++) {
  if (src[i] === '[') depth++;
  else if (src[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
}
const arr = new Function('return (' + src.slice(open, end + 1) + ');')();

// 已补充分平台链接的游戏（用于统计进度）
const withPlatform = arr.filter(g => g.androidUrl || g.iosUrl);
const withAll = arr.filter(g => g.androidUrl && g.iosUrl);

let md = '';
md += '# GAMEHUB 游戏链接表\n\n';
md += '> 本文件由 `scripts/generate-links-doc.js` 自动生成，请勿手动编辑。\n';
md += '> 修改游戏链接请编辑 `data/games.js`，然后运行 `node scripts/generate-links-doc.js` 重新生成此文件。\n\n';
md += '**最后更新：** ' + new Date().toISOString().slice(0, 10) + '\n\n';
md += '**统计：** 共 ' + arr.length + ' 个游戏 · 已补充分平台链接 ' + withPlatform.length + ' 个（' + withAll.length + ' 个同时有安卓+苹果）\n\n';
md += '## 说明\n\n';
md += '- **通用链接**：所有游戏都有，是现在玩家点进去跳转的链接，**不要改**\n';
md += '- **安卓链接 / 苹果链接**：游戏详情弹窗里的"安卓下载" / "苹果下载"按钮对应的链接。\n';
md += '  - 留空 = 详情弹窗里该按钮仍用通用链接\n';
md += '  - 你新发给我的链接，填到对应列即可\n\n';
md += '## 链接表（按热度排序）\n\n';
md += '| id | 热度 | 游戏名 | 通用链接 | 安卓链接 | 苹果链接 |\n';
md += '|----|------|--------|----------|----------|----------|\n';
[...arr]
  .sort((a, b) => (b.heat || 0) - (a.heat || 0))
  .forEach(g => {
    const android = g.androidUrl ? g.androidUrl : '`⚠️ 未提供`';
    const ios = g.iosUrl ? g.iosUrl : '`⚠️ 未提供`';
    md += '| ' + g.id + ' | ' + g.heat + ' | ' + g.name + ' | ' + g.url + ' | ' + android + ' | ' + ios + ' |\n';
  });

md += '\n## 字段格式（参考）\n\n';
md += '在 `data/games.js` 中，每个游戏对象的格式：\n\n';
md += '```javascript\n';
md += '{\n';
md += '  id: 1,                                                // 唯一ID\n';
md += '  name: "龙之谷启程",                                   // 游戏名\n';
md += '  cover: "assets/images/longzhigu_cover.jpg",           // 封面图\n';
md += '  url: "https://sdkn-ldy.zhangyu39.com/...",            // 通用链接（必填，不要改）\n';
md += '  androidUrl: "",                                       // 安卓链接（可选，留空 = 用通用链接）\n';
md += '  iosUrl: "",                                           // iOS/苹果链接（可选，留空 = 用通用链接）\n';
md += '  heat: 930000                                          // 热度值（数字越大越靠前）\n';
md += '}\n';
md += '```\n';

fs.writeFileSync(path.join(ROOT, 'LINKS.md'), md, 'utf8');
console.log('✅ LINKS.md 已生成，共 ' + arr.length + ' 个游戏');
console.log('   已补充分平台链接：' + withPlatform.length + ' / ' + arr.length);
