import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const distDir = resolve(process.cwd(), 'dist')
const indexPath = resolve(distDir, 'index.html')

if (!existsSync(indexPath)) {
  console.error('[copy-404] dist/index.html 不存在，请先执行 vite build')
  process.exit(1)
}

const base = process.env.VITE_BASE || '/'
const prefix = base.endsWith('/') ? base : `${base}/`

const redirect = `<script>(function(){try{var base=${JSON.stringify(prefix)};var p=location.pathname+location.search+location.hash;if(base!=="/"&&p.indexOf(base)===0){p=p.slice(base.length-1);}location.replace(base+"?/redirect="+encodeURIComponent(p));}catch(e){location.replace(base);}})();</script>`

let html = readFileSync(indexPath, 'utf8')
html = html.replace('</head>', `${redirect}\n</head>`)
writeFileSync(resolve(distDir, '404.html'), html, 'utf8')
console.log('[copy-404] 已生成 dist/404.html')
