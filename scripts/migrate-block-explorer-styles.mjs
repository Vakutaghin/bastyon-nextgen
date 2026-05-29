// Одноразовый: в block-page.vue / tx-page.vue заменяем известные inline
// style="..." на готовые SC_-обёртки из shared/text-utility.styled.ts.
// Vue-attrs (v-if/v-else/...) сохраняем — переносим их на новый тег.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const FILES = [
  'src/pages/block-explorer-page/tx-page/tx-page.vue',
  'src/pages/block-explorer-page/block-page/block-page.vue',
]

// Замены: regex по открывающему тегу → пара (новый тег, имя SC).
// Закрывающий </span> или </div> заменяем строго после открывающего.
const RULES = [
  {
    open: /<span\b([^>]*?)\s*style="color: rgb\(173, 181, 189\)"\s*>/g,
    closeTag: '</span>',
    component: 'SC_Muted',
  },
  {
    open: /<span\b([^>]*?)\s*style="font-size: 12px; color: rgb\(173, 181, 189\)"\s*>/g,
    closeTag: '</span>',
    component: 'SC_MutedSm',
  },
  {
    open: /<span\b([^>]*?)\s*style="color: rgb\(173, 181, 189\); font-size: 12px"\s*>/g,
    closeTag: '</span>',
    component: 'SC_MutedSm',
  },
  {
    open: /<span\b([^>]*?)\s*style="color: rgb\(173, 181, 189\); font-size: 12px; margin-left: 8px"\s*>/g,
    closeTag: '</span>',
    component: 'SC_MutedSmInline',
  },
  {
    open: /<div\b([^>]*?)\s*style="font-size: 11px; color: rgb\(173, 181, 189\); margin-top: 2px"\s*>/g,
    closeTag: '</div>',
    component: 'SC_MutedXs',
  },
  {
    open: /<span\b([^>]*?)\s*style="color: rgb\(108, 117, 125\)"\s*>/g,
    closeTag: '</span>',
    component: 'SC_Subtle',
  },
  {
    open: /<span\b([^>]*?)\s*style="font-variant-numeric: tabular-nums"\s*>/g,
    closeTag: '</span>',
    component: 'SC_TabularNums',
  },
]

function rewriteSpans(src) {
  let result = src
  const used = new Set()
  for (const rule of RULES) {
    let next = ''
    let cursor = 0
    let match
    rule.open.lastIndex = 0
    while ((match = rule.open.exec(result)) !== null) {
      const head = result.slice(cursor, match.index)
      const attrs = match[1]
      // Найти соответствующий closeTag — ищем БАЛАНСИРОВАННО, что в нашем случае
      // упрощённо = ближайший closeTag после match.
      const afterOpen = match.index + match[0].length
      const closeIdx = result.indexOf(rule.closeTag, afterOpen)
      if (closeIdx < 0) {
        next += head + match[0]
        cursor = afterOpen
        continue
      }
      // Проверим, что внутри нет другого <span/<div> того же типа (упростим:
      // если внутри есть `<span ` или `<div `, лучше пропустить — есть вложенность).
      const innerSlice = result.slice(afterOpen, closeIdx)
      const sameTag = rule.closeTag === '</span>' ? '<span' : '<div'
      if (innerSlice.includes(sameTag)) {
        next += head + match[0]
        cursor = afterOpen
        continue
      }
      const inner = innerSlice
      next +=
        head +
        `<${rule.component}${attrs}>${inner}</${rule.component}>`
      cursor = closeIdx + rule.closeTag.length
      used.add(rule.component)
    }
    next += result.slice(cursor)
    result = next
  }
  return { result, used }
}

function ensureImport(src, used) {
  if (used.size === 0) return src
  const path = './../components/shared/text-utility.styled'
  const altPath = '../components/shared/text-utility.styled'
  // Файлы — в pages/block-explorer-page/{tx-page,block-page}/, нам нужно
  // дойти до pages/block-explorer-page/components/shared/. Это `../components/shared/`.
  const importPath = '@/pages/block-explorer-page/components/shared/text-utility.styled'

  // Уже есть из этого пути?
  const re = new RegExp(
    `import\\s*\\{([^}]+)\\}\\s*from\\s*['"]${importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`
  )
  if (re.test(src)) {
    return src.replace(re, (m, names) => {
      const list = new Set(names.split(',').map((s) => s.trim()).filter(Boolean))
      for (const u of used) list.add(u)
      return `import { ${[...list].sort().join(', ')} } from '${importPath}'`
    })
  }
  // Вставим перед закрывающим тегом script: ищем последний `import .* from '@/...styled'`
  // и добавляем нашу строку сразу после первого top-level импорта.
  const namesList = [...used].sort().join(', ')
  const stmt = `import { ${namesList} } from '${importPath}'\n`
  // Добавим после последней непрерывной строки `import \w` в начале <script setup>
  const scriptMatch = src.match(/<script\s+setup[^>]*>\s*\n/)
  if (!scriptMatch) return src
  const insertBase = scriptMatch.index + scriptMatch[0].length
  // Найдём конец блока импортов (учитываем многострочные).
  let pos = insertBase
  while (pos < src.length) {
    // Пропускаем pure import-строку
    if (src.startsWith('import ', pos)) {
      const eolIdx = src.indexOf('\n', pos)
      if (eolIdx < 0) break
      // если на этой строке `{` без закрывающего `}`, то это многострочный — съедаем до строки, где встретится `} from '...'`
      const line = src.slice(pos, eolIdx)
      if (line.includes('{') && !line.includes('}')) {
        // ищем строку c `} from`
        let p = eolIdx + 1
        while (p < src.length) {
          const eol2 = src.indexOf('\n', p)
          if (eol2 < 0) {
            pos = src.length
            break
          }
          const l2 = src.slice(p, eol2)
          p = eol2 + 1
          if (l2.includes('} from')) {
            pos = p
            break
          }
        }
      } else {
        pos = eolIdx + 1
      }
    } else {
      break
    }
  }
  return src.slice(0, pos) + stmt + src.slice(pos)
}

let totalReplacements = 0
for (const rel of FILES) {
  const full = join(ROOT, rel)
  const src = readFileSync(full, 'utf8')
  const { result, used } = rewriteSpans(src)
  if (used.size === 0) continue
  const withImport = ensureImport(result, used)
  writeFileSync(full, withImport)
  const before = (src.match(/style="/g) || []).length
  const after = (withImport.match(/style="/g) || []).length
  console.log(`  ${rel}: -${before - after} (${[...used].sort().join(', ')})`)
  totalReplacements += before - after
}
console.log(`\n[migrate-block-explorer-styles] ${totalReplacements} style="" attrs replaced`)
