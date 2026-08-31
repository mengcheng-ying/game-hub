/**
 * 百度链接自动推送脚本（增量版）
 * 每次文章上线后自动运行，只推送本次新增的链接，节省每日配额
 * 需要在仓库 Settings -> Secrets and variables -> Actions 中配置 BAIDU_PUSH_TOKEN
 * 用法：
 *   node baidu-push.js          —— 增量推送（默认，只推本次新增的文章链接）
 *   node baidu-push.js --all    —— 全量推送（手动触发时使用，推送全部链接）
 */
const { execSync } = require('child_process');
const fs = require('fs');

const SITE = 'fmbly.com';
const TOKEN = process.env.BAIDU_TOKEN;
const FORCE_ALL = process.argv.includes('--all');

if (!TOKEN) {
  console.log('⏭ 未配置 BAIDU_PUSH_TOKEN 密钥，本次跳过百度推送。');
  console.log('  配置方法：仓库 Settings -> Secrets and variables -> Actions -> New repository secret');
  console.log('  名称填 BAIDU_PUSH_TOKEN，值填百度资源平台「普通收录-API推送」地址里 token= 后面那串');
  process.exit(0);
}

let urls = [];

if (FORCE_ALL) {
  // ===== 全量模式：推送 sitemap 全部链接 + 全部文章链接 =====
  const sitemap = fs.readFileSync('sitemap.xml', 'utf8');
  urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const articles = fs.readFileSync('data/articles.js', 'utf8');
  [...articles.matchAll(/id\s*:\s*(\d+)/g)].forEach(m => {
    urls.push('https://' + SITE + '/#guide/' + m[1]);
  });
} else {
  // ===== 增量模式：用 git diff 找出本次提交新增的文章 ID =====
  try {
    const diff = execSync('git diff HEAD~1 HEAD -- data/articles.js', { encoding: 'utf8' });
    // 只看新增行（+开头）里新增的 id，已有 id 也会在上下文行出现，但上下文行不带 +
    const addedIds = [...diff.matchAll(/^\+\s+id:\s*(\d+)/gm)].map(m => parseInt(m[1], 10));
    const newIds = [...new Set(addedIds)];
    if (newIds.length === 0) {
      console.log('⏭ 本次提交没有新增文章，跳过推送（节省配额）。');
      process.exit(0);
    }
    urls = newIds.map(id => 'https://' + SITE + '/#guide/' + id);
  } catch (e) {
    console.log('⏭ 无法获取 diff（可能是首次提交），跳过推送。');
    process.exit(0);
  }
}

const unique = [...new Set(urls)];
console.log('本次推送 ' + unique.length + ' 条链接到百度...');
console.log(unique.join('\n'));

// ===== 调用百度推送 API =====
fetch('http://data.zz.baidu.com/urls?site=' + SITE + '&token=' + TOKEN, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: unique.join('\n')
})
  .then(async res => {
    const text = await res.text();
    console.log('百度返回：' + text);
    if (text.includes('"success"')) {
      const m = text.match(/"success":\s*(\d+)/);
      console.log('✅ 推送成功，百度已接收 ' + (m ? m[1] : unique.length) + ' 条链接');
    } else if (text.includes('over quota')) {
      console.log('⚠️ 今日配额已用完，配额每日重置，明天发文时会自动正常推送。');
    } else if (text.includes('token') || text.includes('401')) {
      console.log('❌ token 无效，请检查 BAIDU_PUSH_TOKEN 密钥配置。');
      process.exit(1);
    } else {
      console.log('⚠️ 百度返回异常，请检查站点是否为 ' + SITE);
    }
  })
  .catch(err => {
    console.error('❌ 推送请求失败：' + err.message);
    process.exit(1);
  });
