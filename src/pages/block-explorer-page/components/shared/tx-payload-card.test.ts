import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { i18n } from '@/i18n'
import TxPayloadCard from './tx-payload-card.vue'
import type { PocketPayload } from './parse-pocketnet-payload'

const blank = { template: '<div />' }
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/explorer/tx/:txid', name: 'explorer-tx', component: blank },
    { path: '/explorer/address/:address', name: 'explorer-address', component: blank },
    { path: '/:userName', name: 'profile', component: blank },
  ],
})

function mountCard(payload: PocketPayload | null) {
  return mount(TxPayloadCard, {
    props: { payload },
    global: { plugins: [i18n, router, [VueQueryPlugin, { queryClient: new QueryClient() }]] },
  })
}

const t = (key: string) => i18n.global.t(`explorerShared.${key}`)

// По одной фикстуре на каждую визуальную ветку (kind + вариации type/флагов) и
// ожидаемый заголовок-ключ. Заголовки сверяем через i18n.global.t — тест не
// зависит от активной локали.
const cases: Array<{ name: string; payload: PocketPayload; titleKey: string }> = [
  {
    name: 'post',
    payload: { kind: 'post', type: 200, author: 'PauthorAddr', postId: 'postid' },
    titleKey: 'titlePost',
  },
  {
    name: 'video',
    payload: { kind: 'post', type: 201, author: 'PauthorAddr', postId: 'postid' },
    titleKey: 'titleVideo',
  },
  {
    name: 'article',
    payload: { kind: 'post', type: 202, author: 'PauthorAddr', postId: 'postid' },
    titleKey: 'titleArticle',
  },
  {
    name: 'stream',
    payload: { kind: 'post', type: 203, author: 'PauthorAddr', postId: 'postid' },
    titleKey: 'titleStream',
  },
  {
    name: 'comment',
    payload: {
      kind: 'comment',
      type: 204,
      author: 'Pauthor',
      commentId: 'cid',
      parentPostId: 'pid',
    },
    titleKey: 'titleComment',
  },
  {
    name: 'comment-edit',
    payload: {
      kind: 'comment-edit',
      type: 205,
      author: 'Pauthor',
      editTxId: 'eid',
      originalCommentId: 'oid',
    },
    titleKey: 'titleCommentEdit',
  },
  {
    name: 'upvote-share',
    payload: { kind: 'upvote-share', type: 300, voter: 'Pvoter', postId: 'pid', value: 5 },
    titleKey: 'titlePostScore',
  },
  {
    name: 'c-score',
    payload: { kind: 'c-score', type: 301, voter: 'Pvoter', commentId: 'cid', value: 1 },
    titleKey: 'titleCommentScore',
  },
  {
    name: 'subscribe',
    payload: {
      kind: 'subscribe',
      type: 302,
      from: 'Pa',
      to: 'Pb',
      isUnsubscribe: false,
      isPrivate: false,
    },
    titleKey: 'titleSubscribe',
  },
  {
    name: 'subscribe-private',
    payload: {
      kind: 'subscribe',
      type: 303,
      from: 'Pa',
      to: 'Pb',
      isUnsubscribe: false,
      isPrivate: true,
    },
    titleKey: 'titleSubscribePrivate',
  },
  {
    name: 'unsubscribe',
    payload: {
      kind: 'subscribe',
      type: 304,
      from: 'Pa',
      to: 'Pb',
      isUnsubscribe: true,
      isPrivate: false,
    },
    titleKey: 'titleUnsubscribe',
  },
  {
    name: 'block-user',
    payload: { kind: 'block-user', type: 305, actor: 'Pa', target: 'Pb', isUnblock: false },
    titleKey: 'titleBlockUser',
  },
  {
    name: 'unblock-user',
    payload: { kind: 'block-user', type: 306, actor: 'Pa', target: 'Pb', isUnblock: true },
    titleKey: 'titleUnblockUser',
  },
  {
    name: 'boost',
    payload: { kind: 'boost', type: 307, booster: 'Pb', postId: 'pid', amount: 100000000 },
    titleKey: 'titleBoostPost',
  },
  {
    name: 'account-create',
    payload: { kind: 'account', type: 100, account: 'Pacc', isSetting: false },
    titleKey: 'titleAccountAction',
  },
  {
    name: 'account-setting',
    payload: { kind: 'account', type: 103, account: 'Pacc', isSetting: true },
    titleKey: 'titleProfileChange',
  },
]

describe('tx-payload-card', () => {
  it('renders nothing when payload is null', () => {
    expect(mountCard(null).text()).toBe('')
  })

  it.each(cases)('renders the $name payload with its localized title', ({ payload, titleKey }) => {
    const wrapper = mountCard(payload)
    const title = t(titleKey)
    expect(title.length).toBeGreaterThan(0)
    expect(wrapper.text()).toContain(title)
  })

  it('renders the author address for a post payload', () => {
    const wrapper = mountCard({
      kind: 'post',
      type: 200,
      author: 'PuniqueAuthor',
      postId: 'postid',
    })
    expect(wrapper.text()).toContain('PuniqueAuthor')
    expect(wrapper.text()).toContain(t('author'))
  })
})
