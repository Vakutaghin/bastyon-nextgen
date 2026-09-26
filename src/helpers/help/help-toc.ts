// README.md языка — главная страница справки: заголовок, вступление и
// оглавление. Оглавление — первый маркированный список после первого
// подзаголовка: пункт — ссылка на статью, вложенный список — её подразделы.
// На GitHub этот же файл открывается при входе в папку help/<язык>/.
import type { Token } from 'markdown-it'
import {
  convertTokens,
  tokenizeMarkdown,
  type HelpParseContext,
  type HelpParsedLink,
} from './help-markdown'
import type { HelpBlock, HelpTocNode } from './help-types'

export interface HelpReadme {
  title: string
  intro: HelpBlock[]
  toc: HelpTocNode[]
  links: HelpParsedLink[]
  problems: string[]
}

const TOC_LINK = /^(?:\.\/)?([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/

function tocItem(inline: Token, problems: string[]): HelpTocNode | null {
  const children = (inline.children ?? []).filter(
    (t) => !(t.type === 'text' && t.content.trim() === '')
  )
  const open = children[0]
  const close = children[children.length - 1]
  if (open?.type !== 'link_open' || close?.type !== 'link_close') {
    problems.push(`пункт оглавления должен быть одной ссылкой на статью: «${inline.content}»`)
    return null
  }
  const href = String(open.attrGet('href') ?? '')
  const m = TOC_LINK.exec(href)
  if (!m) {
    problems.push(`в оглавлении ссылка не на статью этой папки: ${href}`)
    return null
  }
  const label = children
    .slice(1, -1)
    .map((t) => t.content)
    .join('')
    .trim()
  return { id: m[1] ?? '', label, children: [] }
}

/** Список оглавления с позиции `start` (bullet_list_open); возвращает узлы и позицию после списка. */
function tocList(tokens: Token[], start: number, problems: string[]): [HelpTocNode[], number] {
  const nodes: HelpTocNode[] = []
  let i = start + 1
  while (i < tokens.length && tokens[i]?.type !== 'bullet_list_close') {
    // list_item_open
    i++
    let node: HelpTocNode | null = null
    while (i < tokens.length && tokens[i]?.type !== 'list_item_close') {
      const tok = tokens[i] as Token
      if (tok.type === 'inline' && !node) {
        node = tocItem(tok, problems)
        i++
      } else if (tok.type === 'bullet_list_open') {
        const [children, next] = tocList(tokens, i, problems)
        if (node) node.children = children
        i = next
      } else {
        i++
      }
    }
    i++
    if (node) nodes.push(node)
  }
  return [nodes, i + 1]
}

export function parseReadme(source: string, ctx: HelpParseContext): HelpReadme {
  const tokens = tokenizeMarkdown(source)
  const problems: string[] = []
  const firstH2 = tokens.findIndex((t) => t.type === 'heading_open' && t.tag === 'h2')
  const head = convertTokens(firstH2 < 0 ? tokens : tokens.slice(0, firstH2), ctx)
  problems.push(...head.problems)
  if (!head.title) problems.push('нет заголовка первого уровня (# Справка …)')

  const listStart = tokens.findIndex((t, idx) => idx > firstH2 && t.type === 'bullet_list_open')
  let toc: HelpTocNode[] = []
  if (firstH2 < 0 || listStart < 0)
    problems.push('нет оглавления: подзаголовок и список ссылок на статьи')
  else toc = tocList(tokens, listStart, problems)[0]

  return { title: head.title, intro: head.blocks, toc, links: head.links, problems }
}
