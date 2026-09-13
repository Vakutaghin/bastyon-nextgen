import { test, expect, type Page } from '@playwright/test'

/**
 * Сейф сида (P0-1) на НАСТОЯЩЕМ IndexedDB реального движка (Chromium и WebKit —
 * последний ближе всего к WKWebView в Tauri/iOS). vitest этого не покрывает:
 * happy-dom без indexedDB, а fake-indexeddb не умеет structured-clone
 * non-extractable CryptoKey (AUDIT_LEFTOVERS VP-1/VP-5).
 *
 * Модули берём прямо с dev-сервера Vite по URL — это те же инстансы, что грузит
 * приложение; между шагами сбрасываем in-memory состояние сейфа.
 */

const VAULT = '/src/blockchain/storage/vault/crypto-vault.ts'
const KEY_STORE = '/src/blockchain/storage/vault/vault-key-store.ts'
const VCRYPTO = '/src/blockchain/storage/vault/vault-crypto.ts'

async function waitForAppMount(page: Page) {
  await page.waitForSelector('#app > *', { timeout: 30_000 })
}

async function wipe(page: Page) {
  await page.evaluate(async () => {
    localStorage.clear()
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('bastyon-vault')
      req.onsuccess = req.onerror = req.onblocked = () => resolve()
    })
  })
}

test.describe('Seed vault on real IndexedDB', () => {
  // Последовательно: три параллельных WebKit-инстанса тормозят IndexedDB так,
  // что 2,5-секундный таймаут стора срабатывает (storage-unavailable) — это не
  // то, что здесь проверяется.
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppMount(page)
    await wipe(page)
  })

  test('IndexedDB key store: non-extractable key round-trips across reload, delete → null', async ({
    page,
  }) => {
    const envelope = await page.evaluate(
      async ([ksUrl, vcUrl]) => {
        const { indexedDbVaultKeyStore } = await import(ksUrl)
        const { generateSecret, wrapSecret, bytesToB64 } = await import(vcUrl)
        const key = await indexedDbVaultKeyStore.createKey()
        let exportRejected = false
        try {
          await crypto.subtle.exportKey('raw', key)
        } catch {
          exportRejected = true
        }
        const secret = generateSecret()
        const env = await wrapSecret(key, secret)
        return { exportRejected, secretB64: bytesToB64(secret), env }
      },
      [KEY_STORE, VCRYPTO]
    )
    expect(envelope.exportRejected).toBe(true)

    await page.reload()
    await waitForAppMount(page)

    const after = await page.evaluate(
      async ([ksUrl, vcUrl, env]) => {
        const { indexedDbVaultKeyStore } = await import(ksUrl)
        const { unwrapSecret, bytesToB64 } = await import(vcUrl)
        const key = await indexedDbVaultKeyStore.getKey()
        if (!key) return { found: false, unwrapped: '' }
        const unwrapped = bytesToB64(await unwrapSecret(key, env))
        await indexedDbVaultKeyStore.deleteKey()
        const gone = (await indexedDbVaultKeyStore.getKey()) === null
        return { found: true, unwrapped, gone }
      },
      [KEY_STORE, VCRYPTO, envelope.env] as const
    )
    expect(after.found).toBe(true)
    expect(after.unwrapped).toBe(envelope.secretB64)
    expect(after.gone).toBe(true)
  })

  test('passwordless vault: mint → reload → silent unlock with the same secret', async ({
    page,
  }) => {
    const first = await page.evaluate(async (url) => {
      const v = await import(url)
      v.__resetVaultForTests()
      const out = await v.ensureInitialized()
      return {
        status: out.status,
        level: out.level,
        secret: v.getVaultSecret(),
        env: localStorage.getItem('BST_VAULT'),
      }
    }, VAULT)
    expect(first.status).toBe('unlocked')
    expect(first.level).toBe('device')
    expect(first.env).toContain('"mode":"device"')

    await page.reload()
    await waitForAppMount(page)

    const second = await page.evaluate(async (url) => {
      const v = await import(url)
      v.__resetVaultForTests()
      const out = await v.ensureVaultReady()
      return { status: out.status, secret: out.status === 'unlocked' ? v.getVaultSecret() : null }
    }, VAULT)
    expect(second.status).toBe('unlocked')
    expect(second.secret).toBe(first.secret)
  })

  test('passphrase mode: enable → reload → needs-passphrase → wrong/right → same secret; destroy wipes key', async ({
    page,
  }) => {
    const first = await page.evaluate(async (url) => {
      const v = await import(url)
      v.__resetVaultForTests()
      const init = await v.ensureInitialized()
      if (init.status !== 'unlocked')
        return { init: init.status, secret: null, level: null, env: null }
      const secret = v.getVaultSecret()
      await v.enablePassphrase('correct horse battery staple')
      return {
        init: init.status,
        secret,
        level: v.getVaultLevel(),
        env: localStorage.getItem('BST_VAULT'),
      }
    }, VAULT)
    expect(first.init).toBe('unlocked')
    expect(first.level).toBe('passphrase')
    expect(first.env).toContain('"mode":"passphrase"')

    await page.reload()
    await waitForAppMount(page)

    const second = await page.evaluate(
      async ([url, ksUrl]) => {
        const v = await import(url)
        const { indexedDbVaultKeyStore } = await import(ksUrl)
        v.__resetVaultForTests()
        const boot = await v.ensureVaultReady()
        const keyAfterEnable = await indexedDbVaultKeyStore.getKey() // должен быть удалён enable'ом
        const wrong = await v.submitPassphrase('nope')
        const right = await v.submitPassphrase('correct horse battery staple')
        const secret = right.ok ? v.getVaultSecret() : null
        await v.destroyVault()
        return {
          boot: boot.status,
          keyAfterEnable: keyAfterEnable === null,
          wrong: wrong.ok,
          right: right.ok,
          secret,
          envAfterDestroy: localStorage.getItem('BST_VAULT'),
          keyAfterDestroy: (await indexedDbVaultKeyStore.getKey()) === null,
        }
      },
      [VAULT, KEY_STORE]
    )
    expect(second.boot).toBe('needs-passphrase')
    expect(second.keyAfterEnable).toBe(true)
    expect(second.wrong).toBe(false)
    expect(second.right).toBe(true)
    expect(second.secret).toBe(first.secret)
    expect(second.envAfterDestroy).toBeNull()
    expect(second.keyAfterDestroy).toBe(true)
  })
})
