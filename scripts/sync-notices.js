/**
 * 同步公告数据：从 data/notices.js 提取 NOTICES 数组，注入到 index.html 中
 * -----------------------------------------
 * 用法：node scripts/sync-notices.js
 *
 * 这样维护方式：
 *   1. 编辑 data/notices.js（添加/修改公告）
 *   2. 运行此脚本，自动同步到 index.html 的内嵌 NOTICES 数组
 *   3. 部署
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const dataPath = path.join(ROOT, 'data/notices.js');
const htmlPath = path.join(ROOT, 'index.html');

const dataSrc = fs.readFileSync(dataPath, 'utf8');
// 提取 NOTICES_DATA 数组
const start = dataSrc.indexOf('NOTICES_DATA');
let open = dataSrc.indexOf('[', start);
let depth = 0, end = -1;
for (let i = open; i < dataSrc.length; i++) {
  if (dataSrc[i] === '[') depth++;
  else if (dataSrc[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
}
const arrText = dataSrc.slice(open, end + 1);
const notices = new Function('return (' + arrText + ');')();

let html = fs.readFileSync(htmlPath, 'utf8');
// 替换内嵌 var NOTICES=[...];
// 匹配 var NOTICES=[\n  { ... }\n];
const re = /var NOTICES=\[[\s\S]*?\];/;
const newBlock = 'var NOTICES=' + JSON.stringify(notices, null, 2).replace(/\n/g, '\n  ') + ';';

if (!re.test(html)) {
  console.error('❌ 没找到 index.html 中的 var NOTICES=[]; 块');
  process.exit(1);
}
html = html.replace(re, newBlock);
fs.writeFileSync(htmlPath, html);
console.log('✅ 同步完成，共 ' + notices.length + ' 条公告已写入 index.html');
