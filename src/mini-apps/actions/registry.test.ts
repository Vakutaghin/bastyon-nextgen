import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  ActionRegistry,
  UnknownActionError,
  InvalidParamsError,
  AuthorizationRequiredError,
  PermissionDeniedError,
} from './registry'
import type { ActionDefinition, ActionMap } from './types'
import { TEST_APP, makeMockHost, setupTestPinia, makeResolver } from './__test-helpers'

describe('ActionRegistry', () => {
  beforeEach(() => {
    setupTestPinia()
  })

  function build(actions: ActionMap, hostOverrides = {}) {
    return new ActionRegistry({
      host: makeMockHost(hostOverrides),
      resolver: makeResolver(),
      actions,
    })
  }

  it('executes a simple action', async () => {
    const handler = vi.fn().mockResolvedValue({ ok: 1 })
    const actions = {
      ping: {
        schema: z.object({}).optional(),
        handler,
      } satisfies ActionDefinition,
    }
    const reg = build(actions)

    const result = await reg.execute('ping', TEST_APP, {}, new AbortController().signal)
    expect(result).toEqual({ ok: 1 })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('throws UnknownActionError for missing action', async () => {
    const reg = build({})
    await expect(
      reg.execute('ghost', TEST_APP, {}, new AbortController().signal)
    ).rejects.toBeInstanceOf(UnknownActionError)
  })

  it('throws InvalidParamsError on schema mismatch', async () => {
    const actions = {
      signthing: {
        schema: z.object({ value: z.string() }),
        handler: vi.fn(),
      } satisfies ActionDefinition,
    }
    const reg = build(actions)
    await expect(
      reg.execute('signthing', TEST_APP, { value: 123 }, new AbortController().signal)
    ).rejects.toBeInstanceOf(InvalidParamsError)
  })

  it('throws AuthorizationRequiredError when authorization needed and user not authed', async () => {
    const actions = {
      protected: {
        schema: z.object({}).optional(),
        authorization: true,
        handler: vi.fn().mockResolvedValue('ok'),
      } satisfies ActionDefinition,
    }
    const reg = build(actions, { isUserAuthenticated: () => false })
    await expect(
      reg.execute('protected', TEST_APP, {}, new AbortController().signal)
    ).rejects.toBeInstanceOf(AuthorizationRequiredError)
  })

  it('proceeds when authorization satisfied', async () => {
    const handler = vi.fn().mockResolvedValue('ok')
    const actions = {
      protected: {
        schema: z.object({}).optional(),
        authorization: true,
        handler,
      } satisfies ActionDefinition,
    }
    const reg = build(actions, { isUserAuthenticated: () => true })
    await reg.execute('protected', TEST_APP, {}, new AbortController().signal)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('throws PermissionDeniedError when prompt denies', async () => {
    const actions = {
      restricted: {
        schema: z.object({}).optional(),
        permissions: ['account'],
        handler: vi.fn(),
      } satisfies ActionDefinition,
    }
    const reg = new ActionRegistry({
      host: makeMockHost(),
      resolver: makeResolver({ auto: false }), // deny
      actions,
    })

    await expect(
      reg.execute('restricted', TEST_APP, {}, new AbortController().signal)
    ).rejects.toBeInstanceOf(PermissionDeniedError)
  })

  it('passes through handler errors', async () => {
    const actions = {
      bad: {
        schema: z.object({}).optional(),
        handler: vi.fn().mockRejectedValue(new Error('boom')),
      } satisfies ActionDefinition,
    }
    const reg = build(actions)
    await expect(reg.execute('bad', TEST_APP, {}, new AbortController().signal)).rejects.toThrow(
      'boom'
    )
  })

  it('passes signal to handler', async () => {
    const ctrl = new AbortController()
    const handler = vi.fn(async ({ signal }) => {
      expect(signal).toBe(ctrl.signal)
      return 'ok'
    })
    const actions = {
      sigtest: {
        schema: z.object({}).optional(),
        handler,
      } satisfies ActionDefinition,
    }
    const reg = build(actions)
    await reg.execute('sigtest', TEST_APP, {}, ctrl.signal)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('has() reports presence', () => {
    const reg = build({ x: { schema: z.unknown(), handler: vi.fn() } })
    expect(reg.has('x')).toBe(true)
    expect(reg.has('y')).toBe(false)
  })
})
