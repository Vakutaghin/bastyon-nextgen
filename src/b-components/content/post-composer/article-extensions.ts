/**
 * Расширения редактора статьи сверх StarterKit: картинка с подписью, блок
 * «как есть» для того, что редактор не знает, и подпись у цитаты — всё, что
 * нужно, чтобы статья из блоков Editor.js прошла правку без потерь
 * (см. article-doc.ts).
 */

import { Extension, Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'

import ArticleImageView from './article-image-view.vue'
import ArticleRawBlockView from './article-raw-block-view.vue'

/** Картинка статьи: адрес, подпись и флаги оформления Editor.js. */
export const ArticleImage = Node.create({
  name: 'articleImage',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: '' },
      caption: { default: '' },
      withBorder: { default: false },
      stretched: { default: false },
      withBackground: { default: false },
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-article-image]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'figure',
      mergeAttributes({ 'data-article-image': '' }),
      ['img', { src: HTMLAttributes.src, alt: HTMLAttributes.caption }],
      ['figcaption', {}, HTMLAttributes.caption],
    ]
  },

  addNodeView() {
    return VueNodeViewRenderer(ArticleImageView)
  },
})

/** Блок, которого редактор не знает: хранится JSON-ом и уходит обратно как был. */
export const ArticleRawBlock = Node.create({
  name: 'rawBlock',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return { block: { default: '' } }
  },

  parseHTML() {
    return [{ tag: 'div[data-raw-block]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { 'data-raw-block': HTMLAttributes.block }]
  },

  addNodeView() {
    return VueNodeViewRenderer(ArticleRawBlockView)
  },
})

/** Подпись и выравнивание цитаты Editor.js — в редакторе не видны, но не теряются. */
export const QuoteAttributes = Extension.create({
  name: 'quoteAttributes',

  addGlobalAttributes() {
    return [
      {
        types: ['blockquote'],
        attributes: {
          caption: { default: '', renderHTML: () => ({}), parseHTML: () => '' },
          alignment: { default: 'left', renderHTML: () => ({}), parseHTML: () => 'left' },
        },
      },
    ]
  },
})
