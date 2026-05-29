// Заменяем inline style="..." в confirm-modal.vue на SC_ModalActions/SC_ModalIconRow.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const FILES = [
  'src/b-components/video-uploader/components/delete-confirm-modal/delete-confirm-modal.vue',
  'src/b-components/header/account-switcher/confirm-delete-modal.vue',
  'src/b-components/header/account-switcher/confirm-show-mnemonic-modal.vue',
  'src/b-components/header/sign-in-modal/sign-in-modal.vue',
  'src/b-components/header/confirm-sign-out-modal/confirm-sign-out-modal.vue',
]

const RULES = [
  {
    open: /<div\b([^>]*?)\s*style="display: flex; justify-content: flex-end; gap: 8px;"\s*>/g,
    closeTag: '</div>',
    component: 'SC_ModalActions',
  },
  {
    open: /<div\b([^>]*?)\s*style="display: flex; align-items: center; gap: 12px;"\s*>/g,
    closeTag: '</div>',
    component: 'SC_ModalIconRow',
  },
]

function rewriteDivs(src) {
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
      const afterOpen = match.index + match[0].length
      // Найти соответствующий closeTag, учитывая вложенные <div>.
      let depth = 1
      let pos = afterOpen
      let closeIdx = -1
      while (pos < result.length) {
        const nextOpen = result.indexOf('<div', pos)
        const nextClose = result.indexOf('</div>', pos)
        if (nextClose < 0) break
        if (nextOpen >= 0 && nextOpen < nextClose) {
          depth++
          pos = nextOpen + 4
        } else {
          depth--
          if (depth === 0) {
            closeIdx = nextClose
            break
          }
          pos = nextClose + 6
        }
      }
      if (closeIdx < 0) {
        next += head + match[0]
        cursor = afterOpen
        continue
      }
      const inner = result.slice(afterOpen, closeIdx)
      next += head + `<${rule.component}${attrs}>${inner}</${rule.component}>`
      cursor = closeIdx + '</div>'.length
      used.add(rule.component)
    }
    next += result.slice(cursor)
    result = next
  }
  return { result, used }
}

function ensureImport(src, used) {
  if (used.size === 0) return src
  const importPath = '@/components/modal'
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
  // Вставим перед последним `import` в начале <script setup>
  const namesList = [...used].sort().join(', ')
  const stmt = `import { ${namesList} } from '${importPath}'\n`
  const scriptMatch = src.match(/<script\s+setup[^>]*>\s*\n/)
  if (!scriptMatch) return src
  // После последовательного блока import-строк в начале скрипта (включая многострочные)
  let pos = scriptMatch.index + scriptMatch[0].length
  while (pos < src.length) {
    if (!src.startsWith('import ', pos)) break
    const eolIdx = src.indexOf('\n', pos)
    if (eolIdx < 0) break
    const line = src.slice(pos, eolIdx)
    if (line.includes('{') && !line.includes('}')) {
      // multi-line — пропустить до строки с `} from`
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
  }
  return src.slice(0, pos) + stmt + src.slice(pos)
}

let total = 0
for (const rel of FILES) {
  const full = join(ROOT, rel)
  const src = readFileSync(full, 'utf8')
  const { result, used } = rewriteDivs(src)
  if (used.size === 0) continue
  const withImport = ensureImport(result, used)
  writeFileSync(full, withImport)
  const before = (src.match(/style="/g) || []).length
  const after = (withImport.match(/style="/g) || []).length
  console.log(`  ${rel}: -${before - after} (${[...used].sort().join(', ')})`)
  total += before - after
}
console.log(`\n[migrate-modal-styles] ${total} style="" attrs replaced`)
