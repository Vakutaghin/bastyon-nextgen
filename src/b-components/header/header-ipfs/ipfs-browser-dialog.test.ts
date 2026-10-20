// IPFS-браузер: в адресную строку вставляют ссылку, CID или адрес шлюза —
// содержимое открывается окном-просмотрщиком, как по клику; не ссылка —
// подсказка, что подойдёт; недавние адреса открываются одним нажатием,
// приватные ссылки в недавние не попадают.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({ openIpfsViewer: vi.fn(async () => {}) }))
vi.mock('@/composables/use-ipfs-links', () => ({ openIpfsViewer: mocks.openIpfsViewer }))

import IpfsBrowserDialog from './ipfs-browser-dialog.vue'

const CID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
let wrapper: VueWrapper | null = null

const text = () => document.body.textContent?.replace(/\s+/g, ' ') ?? ''
const input = () => document.body.querySelector('input') as HTMLInputElement

async function openDialog(): Promise<void> {
  wrapper = mount(IpfsBrowserDialog, {
    attachTo: document.body,
    props: { open: true },
    global: { plugins: [i18n] },
  })
  await flushPromises()
}

async function type(value: string): Promise<void> {
  input().value = value
  input().dispatchEvent(new Event('input'))
  await flushPromises()
  ;(document.body.querySelector('form') as HTMLFormElement).dispatchEvent(
    new Event('submit', { cancelable: true })
  )
  await flushPromises()
}

describe('IpfsBrowserDialog', () => {
  beforeAll(async () => {
    await setI18nLocale('ru')
  })
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('пустая строка с курсором; адрес шлюза открывается и запоминается', async () => {
    await openDialog()
    expect(text()).toContain('IPFS-браузер')
    expect(document.activeElement).toBe(input())
    await type(`ipfs.io/ipfs/${CID}/wiki/Cat.jpg`)
    expect(mocks.openIpfsViewer).toHaveBeenCalledWith(
      { namespace: 'ipfs', root: CID, path: 'wiki/Cat.jpg' },
      null,
      null
    )
    expect(wrapper!.emitted('close')).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem('ipfs:recent')!)).toEqual([`ipfs://${CID}/wiki/Cat.jpg`])
  })

  it('не ссылка — подсказка, ничего не открывается', async () => {
    await openDialog()
    await type('котики')
    expect(text()).toContain('Это не ссылка IPFS')
    expect(mocks.openIpfsViewer).not.toHaveBeenCalled()
    expect(wrapper!.emitted('close')).toBeUndefined()
  })

  it('приватная ссылка открывается с ключом, но в недавние не попадает', async () => {
    await openDialog()
    await type(`ipfs://${CID}/a.pdf#key=c2VjcmV0&name=a.pdf`)
    expect(mocks.openIpfsViewer).toHaveBeenCalledWith(
      { namespace: 'ipfs', root: CID, path: 'a.pdf' },
      { key: 'c2VjcmV0', name: 'a.pdf' },
      null
    )
    expect(localStorage.getItem('ipfs:recent')).toBeNull()
  })

  it('недавние: открыть одним нажатием, убрать крестиком', async () => {
    localStorage.setItem('ipfs:recent', JSON.stringify([`ipfs://${CID}`, 'ipns://k51old']))
    await openDialog()
    expect(text()).toContain('Недавние')
    const link = [...document.body.querySelectorAll('li button')].find(
      (b) => b.textContent === `ipfs://${CID}`
    ) as HTMLButtonElement
    link.click()
    await flushPromises()
    expect(mocks.openIpfsViewer).toHaveBeenCalledWith(
      { namespace: 'ipfs', root: CID, path: '' },
      null,
      null
    )

    const forget = document.body.querySelectorAll('button[aria-label="Убрать из недавних"]')
    ;(forget[1] as HTMLButtonElement).click()
    await flushPromises()
    expect(JSON.parse(localStorage.getItem('ipfs:recent')!)).toEqual([`ipfs://${CID}`])
  })
})
