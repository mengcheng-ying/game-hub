/**
 * 百度链接自动推送脚本
 * 每次文章上线（git push）后自动运行，把全部链接推送给百度加快收录
 * 需要在仓库 Settings -> Secrets and variables -> Actions 中配置 BAIDU_PUSH_TOKEN
 */
const fs = require('fs');

const SITE = 'mengchen.me';
const TOKEN = process.env.BAIDU_TOKEN;

if (!TOKEN) {
  console.log('⏭ 未配置 BAIDU_PUSH_TOKEN 密钥，本次跳过百度推送。');
  console.log('  配置方法：仓库 Settings -> Secrets and variables -> Actions -> New repository secret');
  console.log('  名称填 BAIDU_PUSH_TOKEN，值填百度资源平台「普通收录-API推送」地址里 token= 后面那串');
  process.exit(0);
}

// ===== 1. 收集 sitemap 中的链接 =====
const sitemap = fs.readFileSync('sitemap.xml', 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

// ===== 2. 收集全部文章链接 =====
const articles = fs.readFileSync('data/articles.js', 'utf8');
[...articles.matchAll(/id\s*:\s*(\d+)/g)].forEach(m => {
  urls.push('https://' + SITE + '/#guide/' + m[1]);
});

const unique = [...new Set(urls)];
console.log('本次推送 ' + unique.length + ' 条链接到百度...');

// ===== 3. 调用百度推送 API =====
fetch('http://data.zz.baidu.com/urls?site=' + SITE + '&token=' + TOKEN, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: unique.join('\n')
})
  .then(async res => {
    const text = await res.text();
    console.log('百度返回：' + text);
    // 正常返回形如 {"remain":4999,"success":50}
    if (text.includes('"success"')) {
      console.log('✅ 推送成功');
    } else {
      console.log('⚠️ 百度未返回成功标记，请检查 token 是否正确、站点是否为 ' + SITE);
    }
  })
  .catch(err => {
    console.error('❌ 推送请求失败：' + err.message);
    process.exit(1);
  });
