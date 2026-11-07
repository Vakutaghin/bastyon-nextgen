import { describe, it, expect, beforeEach } from 'vitest'
import {
  openVideoDialog,
  resolveVideoDialog,
  isVideoDialogOpen,
  videoDialogAppName,
  _resetVideoDialogForTests,
} from './video-dialog-controller'
import {
  openComplainDialog,
  resolveComplainDialog,
  isComplainDialogOpen,
  complainRequest,
  _resetComplainDialogForTests,
} from './complain-dialog-controller'

beforeEach(() => {
  _resetVideoDialogForTests()
  _resetComplainDialogForTests()
})

describe('video-dialog-controller', () => {
  it('окно открыто до ответа; ответ — указатель и имя', async () => {
    const p = openVideoDialog('Barteron')
    expect(isVideoDialogOpen.value).toBe(true)
    expect(videoDialogAppName.value).toBe('Barteron')
    resolveVideoDialog({ link: 'peertube://h/u', name: 'Ролик' })
    expect(await p).toEqual({ link: 'peertube://h/u', name: 'Ролик' })
    expect(isVideoDialogOpen.value).toBe(false)
  })

  it('второе окно поверх первого — отказ videos:dialog:busy', async () => {
    void openVideoDialog('A')
    await expect(openVideoDialog('B')).rejects.toThrow('videos:dialog:busy')
  })

  it('запрос приложения отменён — окно закрывается, ответ null', async () => {
    const ctrl = new AbortController()
    const p = openVideoDialog('Barteron', ctrl.signal)
    ctrl.abort()
    expect(await p).toBeNull()
    expect(isVideoDialogOpen.value).toBe(false)
  })
})

describe('complain-dialog-controller', () => {
  const req = {
    appName: 'Barteron',
    entity: { link: '/application?id=x', txid: 't', type: 'offer' },
  }

  it('окно знает, на что жалоба; ответ — ушла ли она', async () => {
    const p = openComplainDialog(req)
    expect(isComplainDialogOpen.value).toBe(true)
    expect(complainRequest.value).toEqual(req)
    resolveComplainDialog(true)
    expect(await p).toBe(true)
    expect(complainRequest.value).toBeNull()
  })

  it('второе окно — отказ; отмена запроса — false', async () => {
    const ctrl = new AbortController()
    const p = openComplainDialog(req, ctrl.signal)
    await expect(openComplainDialog(req)).rejects.toThrow('complain:busy')
    ctrl.abort()
    expect(await p).toBe(false)
    expect(isComplainDialogOpen.value).toBe(false)
  })
})
