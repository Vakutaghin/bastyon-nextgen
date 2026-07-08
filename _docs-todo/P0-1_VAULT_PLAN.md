# P0-1 Seed-at-Rest Vault — Review-Ready Implementation Plan

> Provenance: synthesized from a multi-agent design pass — 3 independent architectures
> (security-first / minimal-diff / UX-recovery) → 6 adversarial critiques (data-loss/lockout +
> correctness/platform) → synthesis. Every critic MUST-FIX is mapped to a mechanism in §5–§9 and
> cross-referenced (e.g. `[B1]`, `[P0-A]`). Direction (WebCrypto default + opt-in passphrase) is fixed
> by the product owner; this designs the details. **Awaiting sign-off on §10 before implementation.**
>
> Empirical env probe (happy-dom): `crypto.subtle` + AES-GCM roundtrip work, `navigator.locks` and
> `BroadcastChannel` present, `indexedDB` and `navigator.storage.persist` **absent**, PBKDF2-SHA256/600k
> ≈ 74 ms. Deps present: `crypto-js`, `pbkdf2`, `buffer`, Dexie `4.2.1`, `@capacitor/preferences@8`.
> Absent: `argon2`/`hash-wasm`/`idb`/`fake-indexeddb`.

## 1. Architecture summary

**One indirection: the vault secret `S`.** `S` = 32 random bytes (`crypto.getRandomValues`), materialized as base64 when handed to the *unchanged* crypto-js seam.

- **Payloads unchanged.** `BST_MNEMONIC`, `BST_ACCOUNTS_LIST`, `BST_ACCOUNT_<addr>` stay in the existing `v2:` crypto-js AES-256-CBC + PBKDF2-100k format, byte-for-byte. Only the **key argument** changes: `getDeviceFingerprint()` → `getVaultSecret()` (a sync accessor returning `base64(S)`). PBKDF2-100k over a full-entropy `S` is redundant-but-harmless; keeping the format means **passphrase toggles never re-encrypt payloads** and the whole storage layer stays **synchronous**.
- **`S` is never stored in cleartext.** It is written only *wrapped*, in a small localStorage envelope `BST_VAULT`. Wrapping/unwrapping is the only async crypto, done **once at boot** via native `crypto.subtle` AES-GCM, then `S` is cached in a module-level variable.

**Passwordless mode (default, no UX change).** `S` is wrapped by a **non-extractable AES-GCM `CryptoKey` `K_device`** generated with `extractable:false` and stored in **IndexedDB**. Its raw bytes are unexportable and live outside localStorage → a flat localStorage/text copy no longer decrypts anything. This is the P0-1 fix.

**Opt-in passphrase mode.** `S` is wrapped by `K_pass = PBKDF2(passphrase, salt)` (native `crypto.subtle`, non-extractable derived key, used once then dropped). Enabling **deletes `K_device` from IndexedDB**, so neither a localStorage dump nor an IndexedDB dump unwraps `S` without the passphrase. Passphrase/`K_pass` are never persisted.

**KDF choice + params.** `PBKDF2-HMAC-SHA256`, **600 000 iterations**, 256-bit output, 16-byte random salt, via `crypto.subtle.deriveBits`. Rationale: native (zero new deps, no wasm, **no COOP/COEP fight** unlike Argon2 — the project already battles that for ffmpeg.wasm); off the main thread; measured 74 ms in CI and sub-second on real hardware for a **one-time** boot unlock. `kdf`/`hash`/`iter`/`salt` live in the envelope → **self-tuning**: on a successful unlock, if `iter < target`, transparently re-derive and re-wrap `S` at the higher count, and the `kdf` field lets us drop in Argon2id later without breaking existing vaults.

**Honest threat boundary (state in code comments + Settings copy).** Passwordless defends **exactly** a *flat localStorage/text copy*. It does **not** defend a full-profile-including-IndexedDB copy (`K_device` travels and, though non-extractable, is still *usable* same-origin), same-origin XSS/arbitrary JS (reads unlocked `S`), or a stolen unlocked device. Passphrase mode adds defense against the full-profile/cloud-sync copy; nothing defends the seed against arbitrary same-origin JS once loaded.

## 2. Storage layout

### localStorage

| Key | New? | Format |
|---|---|---|
| `BST_VAULT` | NEW | Plaintext JSON envelope wrapping `S`. Device: `{v:1,mode:'device',iv:b64(12),ct:b64(AES-GCM(K_device,iv,S)),migrated:bool}`. Passphrase: `{v:1,mode:'passphrase',kdf:'PBKDF2',hash:'SHA-256',iter:600000,salt:b64(16),iv:b64(12),ct:b64(AES-GCM(K_pass,iv,S))}`. Safe in plaintext: `ct` is useless without IDB key (device) or passphrase. |
| `BST_VAULT_BACKUP` | NEW | Byte-mirror of `BST_VAULT`, rewritten on every envelope change. Read-fallback if primary fails to parse/GCM-verify `[A4]`. |
| `BST_VAULT_MIGRATION` | NEW, transient | In-progress marker `{token,phase}` for crash-safe migration/enable/disable; removed on finalize. |
| `BST_VAULT_ATTEMPTS` | NEW, transient | Plaintext `{attempts,cooldownUntil}` for wrong-passphrase throttling (not a secret). Cleared on unlock/reset. |
| `BST_MNEMONIC` | unchanged key | `v2:` now under `S` (was fingerprint). |
| `BST_ACCOUNTS_LIST` | unchanged key | `v2:` (bare ciphertext, no `{data,…}` envelope) under `S`. |
| `BST_ACCOUNT_<addr>` | unchanged keys | `v2:` (`{data,timestamp,version}` envelope) under `S`. |
| `BST_DEVICE_FINGERPRINT` | **deleted after successful migration** | Kept only for migration read + degraded fallback; deleted last, gated on verify. |
| `BST_USER_ADDRESS`, `BST_WAS_LOGGED`, `BST_WALLET_ADDRS_*`, `BST_ADDITIONAL_WALLETS_LIST`, `BST_WALLET_LABELS` | unchanged | public/non-secret, untouched. |
| sessionStorage `BST_MNEMONIC` (legacy) | migrated then cleared | scanned so `F`-deletion can't orphan it `[M3]`. |

### IndexedDB

- Dedicated DB **`bastyon-vault`**, objectStore **`keys`**, record id **`'wrap'`** → non-extractable AES-GCM `K_device` (**device mode only; absent in passphrase mode**). Deliberately **not** in `BastyonDB`/Dexie so vault availability doesn't couple to the app-DB schema/migrations or the `initDatabase()` timeout.
- (Phase-2, §10) Native Capacitor backend: random 256-bit `D` in `@capacitor/preferences` (iOS Keychain / Android EncryptedSharedPreferences) instead of evictable IDB.

## 3. Module API

New family under `src/blockchain/storage/vault/`. `crypto-vault.ts` + `vault-crypto.ts` + `vault-key-store.ts` are **framework-free** (unit-testable under happy-dom). `vault-unlock.ts` is the only vault file that touches Pinia/modal-store.

```ts
// ── vault-key-store.ts — injectable backend (DI mirrors kvStore/createMemoryStore) ──
export interface VaultKeyStore {
  getKey(): Promise<CryptoKey | null>
  setKey(k: CryptoKey): Promise<void>   // MUST await transaction.oncomplete, not request.onsuccess  [C3]
  deleteKey(): Promise<void>
}
export const indexedDbVaultKeyStore: VaultKeyStore   // default; every op raced against ~2.5s timeout  [B1]
export function createMemoryVaultKeyStore(): VaultKeyStore   // tests: Map<string,CryptoKey>

// ── crypto-vault.ts — state machine + sync accessor (module-level, NOT Pinia/reactive) ──
export type VaultStatus =
  | 'unknown' | 'empty' | 'unlocked'
  | 'needs-passphrase' | 'reset-requested'
  | 'storage-unavailable'   // transient IDB hang/unavailable — NON-destructive  [B1/D2]
  | 'degraded-fingerprint'  // no subtle / no secure context / can't persist key — level 0, surfaced  [D1]
export type VaultLevel = 'none' | 'device' | 'passphrase'
export type VaultOutcome = { status: VaultStatus; level: VaultLevel }

export function configureVault(deps: Partial<{ keyStore: VaultKeyStore }>): void
export function getVaultSecret(): string    // SYNC. unlocked→base64(S); degraded→fingerprint; else THROW VaultLockedError
export function getVaultLegacyKey(): string | null  // raw-read BST_DEVICE_FINGERPRINT, never regenerate  [P1-I]
export function getVaultLevel(): VaultLevel
export function hasVault(): boolean          // crash-proof parse of BST_VAULT  [C5]
export function isUnlocked(): boolean

export function ensureVaultReady(): Promise<VaultOutcome>  // THE boot gate; memoized; NEVER rejects; NEVER caches infra failures  [A2/B3]
export function ensureInitialized(): Promise<VaultOutcome>  // first-persist: create-once S+K_device under lock; idempotent  [C2/C3]
export function lockVault(): void            // clear S from memory + reset memo + status  [C3]
export async function destroyVault(): Promise<void>  // wipe envelope(+backup)+IDB key+fingerprint; lock

export async function enablePassphrase(pw: string): Promise<void>   // requires unlocked; crash-atomic  [C1/P1-E]
export async function disablePassphrase(pw: string): Promise<void>  // requires current pw; crash-atomic
export async function submitPassphrase(pw: string): Promise<{ ok: boolean; reason?: 'bad-passphrase' }>

// ── vault-unlock.ts — UI-aware boot orchestrator (DI bridge to modal-store) ──
export function configureUnlockUi(bridge: { requestPassphrase(state): Promise<...>; hostAvailable(): boolean }): void
export async function ensureVaultUnlocked(): Promise<VaultOutcome>  // wraps ensureVaultReady + drives the modal loop; embed-safe  [A4/H2]
```

**Invariants baked in:** fresh random 12-byte IV on **every** wrap; fresh 16-byte salt on every `enablePassphrase`/rotate `[C1]`. `S` held as `Uint8Array`, `.fill(0)` on lock (best-effort; JS can't guarantee erasure — stated honestly), never in Pinia/reactive state.

## 4. Exact file-change list

| Path | New/Edited | Change |
|---|---|---|
| `src/blockchain/storage/vault/crypto-vault.ts` | NEW | State machine, `ensureVaultReady`/`ensureInitialized`, sync `getVaultSecret`, enable/disable, lock/destroy, cross-tab lock helper, capability detection. |
| `src/blockchain/storage/vault/vault-crypto.ts` | NEW | Pure WebCrypto: gen non-extractable `K_device`, PBKDF2-derive `K_pass`, AES-GCM wrap/unwrap, b64 helpers. |
| `src/blockchain/storage/vault/vault-key-store.ts` | NEW | `VaultKeyStore` iface, hand-rolled raw-IDB store (one store, one record, `await oncomplete`, per-op timeout), `createMemoryVaultKeyStore()`. No `idb` dep. |
| `src/blockchain/storage/vault/vault-migration.ts` | NEW | `migrateLegacyToVault()` — scan + per-payload re-key + verify + gated `F`-delete (§5). |
| `src/blockchain/storage/vault/vault-unlock.ts` | NEW | `ensureVaultUnlocked()` boot orchestrator; passphrase modal loop; embed/no-host fallback; module-level resolver (not in store state) `[H2]`. |
| `src/components/vault/vault-unlock-modal.vue` | NEW | Non-dismissible boot modal; passphrase input + "Forgot passphrase → restore with 12 words"; throttle countdown. Reuses `modal.vue`, COLORS/Z_INDEX, styled-components, single quotes, kebab-case. |
| **`src/blockchain/storage/storage-keys.ts`** | EDITED | L11 import `getDeviceFingerprint`→`getVaultSecret,getVaultLegacyKey`. `saveEncryptedData` L22-23: `getDeviceFingerprint()`→`getVaultSecret()`. `loadEncryptedData` L84-86: try-`S`-then-`legacyKey` **heal** (below). |
| **`src/blockchain/storage/storage-accounts.ts`** | EDITED | L9 import swap. `saveAccountsList` L19→`getVaultSecret()`. `loadAccountsList` L47: try-`S`-then-`legacyKey` heal (bare-ciphertext re-save). |
| `src/blockchain/store/auth-store.ts` | EDITED | `_restoreSessionImpl` (top of `try`, L355): `await ensureVaultUnlocked()` + outcome handling (§6). `register` L197-201 & `signIn` L251-262: `await ensureInitialized()` **before** first persist, degrade-not-throw. `signOut` L308: `await destroyVault()`. `removeAccount` L575 (last account): `await destroyVault()`. |
| `src/blockchain/store/keys-store.ts` | EDITED (belt) | `addAccountForAddress` L82: `getVaultSecret()` will throw if locked → guarded by callers already awaiting `ensureInitialized`; add `await ensureVaultReady()` guard in `recoverFromAccount`/`getMessengerKeys` (both post-auth) as defense-in-depth. |
| `src/blockchain/storage/storage-manager.ts` | EDITED | `clearAllUserData()` L69: also enumerate + remove all `BST_ACCOUNT_*`, `BST_VAULT`, `BST_VAULT_BACKUP`, `BST_VAULT_MIGRATION`, `BST_DEVICE_FINGERPRINT` (sync LS ops; folds P1-12). Async IDB-key delete is `destroyVault()` (awaited by signOut). |
| `src/blockchain/storage/device-fingerprint.ts` | EDITED | Add `readStoredFingerprint(): string \| null` = **raw** `localStorage.getItem`, never regenerate `[P1-I]`. Stop being the seam key; keep `getDeviceFingerprint` only for degraded-mode. |
| `src/stores/modal-store.ts` | EDITED | Add `vaultUnlock` slice `{isOpen,phase,attempts,cooldownUntil,error}` mirroring `authModal`; open/close actions. Resolver callback lives in `vault-unlock.ts` module scope, **not** here. |
| `src/src.vue` | EDITED (~L58) | Mount `<VaultUnlockModal />` beside `<ReportModal />` in the non-embed block. Eager unlock is skipped on embed routes (§6), so no embed hang. |
| `src/main.ts` | EDITED (~L70) | After `useAuthStore(pinia)`: `if (!isEmbedRoute()) ensureVaultUnlocked().catch(()=>{})` fire-and-forget (mirrors `torStore.hydrate().catch`), so the modal renders the instant the app mounts, decoupled from the router guard. Default `configureVault` deps bind at module import (before this kick). |
| `src/blockchain/storage/index.ts` | EDITED | Export vault public API. |
| `src/blockchain/constants/storage.ts` | EDITED | Add `BST_VAULT`, `BST_VAULT_BACKUP`, `BST_VAULT_MIGRATION`, `BST_VAULT_ATTEMPTS` keys. |
| `src/pages/settings-page/settings-page.vue` (+ new `security-tab.vue` or fold into `private-key-tab.vue`) | EDITED/NEW | Enable/disable passphrase dialogs; security-level indicator; recovery-phrase backup nudge. |
| `src/blockchain/storage/encryption.ts` | UNCHANGED | Payload cipher untouched. |
| Tests | NEW/EDITED | §8. |
| `package.json` | EDITED | devDep `fake-indexeddb` for real-keystore coverage `[H4]`. |

**The heal branch (identical shape in both seam load functions)** — resolves `[B1(ux)]`, `[C4]`, `[B2]`:

```ts
const key = getVaultSecret()                 // throws VaultLockedError if locked → caught → {success:false}, non-destructive
let decrypted: string
try {
  decrypted = decryptData(blob, key)         // steady state: only this line runs (legacyKey()===null)
} catch (e) {
  const legacy = getVaultLegacyKey()         // raw-read fingerprint; null once migration finished
  if (!legacy) throw e
  decrypted = decryptData(blob, legacy)      // may throw → genuine failure, rethrow
  try {                                       // heal write is BEST-EFFORT, isolated  [C4]
    storage.setItem(storageKey, /* re-encrypt under S, envelope for keys / bare for list */)
  } catch { /* quota etc: return decrypted anyway, never fail the read */ }
}
return decrypted
```

## 5. Migration algorithm (crash-safe, self-healing, never-brick)

Runs **inside `ensureVaultReady`**, under a **cross-tab lock** `[A2/P0-A/C1]`. Ordering rule everywhere: **construct-before-reference, destroy-after-commit; the `BST_VAULT` localStorage write is the atomic commit; delete `F` last, gated on verify** `[C1/C3/P1-E]`.

```
async function ensureVaultReady():
  if memoized vaultReady: return it
  vaultReady = withVaultLock('bastyon-vault-init', run);
  try: return await vaultReady
  finally: if (outcome was infra-failure) vaultReady = null   // never memoize transient failures [A2/B3]

async function run():
  if !cryptoSubtleAvailable() || !isSecureContext:            // [D1/P1-G]
     return { status:'degraded-fingerprint', level:'none' }   // getVaultSecret()→fingerprint; NEVER throw; surface loudly
  parse BST_VAULT (crash-proof); on parse fail → try BST_VAULT_BACKUP  // [A4/C5]

  // (A) envelope present
  if envelope.mode == 'device':
     K = await keyStore.getKey()            // raced vs ~2.5s timeout
     if timeout   → return {status:'storage-unavailable'}     // NON-destructive, retry next boot [B1/D2]
     if K == null → return {status:'needs-reset'}             // evicted → recovery UI (mnemonic) [A5/C2]
     S = AES-GCM.unwrap(K, envelope); cache S; migrateLegacyToVault(); return {status:'unlocked',level:'device'}
  if envelope.mode == 'passphrase':
     return {status:'needs-passphrase',level:'passphrase'}    // vault-unlock.ts drives the modal loop

  // (B) no envelope
  if BST_ACCOUNTS_LIST or BST_ACCOUNT_* present but envelope absent/corrupt:  // [C5] never fresh-init over S-ciphertext
     if BST_DEVICE_FINGERPRINT present → BOOTSTRAP-FROM-LEGACY (below)
     else → return {status:'needs-reset'}                     // S-ciphertext with no key & no fp → recovery
  if hasStoredSession() && BST_DEVICE_FINGERPRINT present → BOOTSTRAP-FROM-LEGACY
  else → return {status:'empty'}                              // brand-new user; ensureInitialized mints on first persist

BOOTSTRAP-FROM-LEGACY:  // migrate existing fingerprint wallet
  1. fp = readStoredFingerprint()            // raw read, never regenerate [P1-I]
  2. S = random(32); K = generateKey(extractable:false)
  3. await keyStore.setKey(K)                 // await transaction.oncomplete — DURABLE before envelope [C3]
     if setKey fails/timeouts → abort: leave fp + payloads intact → {status:'degraded-fingerprint'} [D2] (retry next boot)
  4. env = {mode:'device', iv, ct:wrap(K,S), migrated:false}
     write BST_VAULT_BACKUP then BST_VAULT   // commit; K already durable
  5. round-trip verify: getKey→unwrap === S  // [C3] if fails → abort, delete env+K, keep fp
  6. cache S; migrateLegacyToVault()

migrateLegacyToVault():  // idempotent, per-payload isolated
  keys = scan(localStorage BST_ACCOUNT_*) ∪ {BST_MNEMONIC, BST_ACCOUNTS_LIST} ∪ sessionStorage BST_MNEMONIC  // [M3]
  allOk = true
  for each key:
     blob = read(key); if empty → skip (non-critical) [C13]
     plain = try decryptData(blob, S) else decryptData(blob, fp)   // dual-key
     // plausibility BEFORE write-back (defeats 1/256 CBC false-unpad) [B2/A3/P0-D]:
     ok = (key==BST_MNEMONIC)      ? validateMnemonic(plain)
        : (key==BST_ACCOUNTS_LIST) ? JSON.parse(plain) has {accounts:Array, currentAccount}
        : /* BST_ACCOUNT_* */        validateMnemonic(plain) || recoverKeyPair(plain) succeeds   // mnemonic OR WIF/hex
     if !ok: allOk=false; continue        // leave under fp; never delete fp; route later to per-account re-import
     newBlob = encryptData(plain, S)
     if decryptData(newBlob,S) !== plain: allOk=false; continue    // round-trip gate [A3]
     try write(key,newBlob) catch { allOk=false }                  // best-effort; quota → keep fp [C4/K3]
  if allOk: remove BST_DEVICE_FINGERPRINT; env.migrated=true; rewrite BST_VAULT(+BACKUP)   // [C1] delete-old-LAST
  // rebuild BST_ACCOUNTS_LIST under S from the BST_ACCOUNT_* scan if the old list failed to decrypt [D3]
```

**Enable/disable passphrase (same crash-atomic discipline** `[P1-E/C12]`**):** write `BST_VAULT_MIGRATION` marker → construct new wrap material → **write new `BST_VAULT`(+BACKUP)** (commit) → round-trip verify → **only then** destroy old material (`enable`: `deleteKey()`; `disable`: confirm fresh `K_device` durable before dropping the passphrase envelope) → clear marker. On boot, if both `passWrap`-shaped envelope *and* an orphan `K_device` exist → passphrase wins, delete the orphan `K_device` `[P1-E]`.

**IndexedDB key lost → mnemonic recovery path:** any `needs-reset` outcome (evicted `K_device`, corrupt envelope with no fp, forgotten passphrase) routes to the boot modal's **"Restore with your 12-word recovery phrase"** → explicit confirm → `destroyVault()` + `clearAllUserData()` → Import flow → `signIn(mnemonic)` → `ensureInitialized()` mints a fresh passwordless vault. The 12 words are the ultimate backup, per the decentralization principle. **A transient `storage-unavailable` never routes here** — it drops `restoring→unauthenticated` non-destructively and self-heals next boot `[P0-C]`.

## 6. Async/sync resolution (zero pre-unlock decrypts, both restore sites)

- **`getVaultSecret()` is sync** and only reads cached `S`. crypto-js stays 100% sync; async lives solely in `ensureVaultReady` (IDB read + AES-GCM/PBKDF2), run **once** before the seam is used.
- **The gate is `await ensureVaultUnlocked()` as the first statement of `_restoreSessionImpl`'s `try`** (before `loadAccountsList()` L375). Every boot decrypt lives below it in the same function.
- **Both restore sites** — `use-registration-flow.ts:289` (onMounted) and `router/index.ts:167` (guard) — already funnel through `restoreSession()` → `restoreInFlight` dedup → the single `_restoreSessionImpl`. `ensureVaultUnlocked` adds a **second, lower** dedup via the memoized `vaultReady` promise, so even the eager `main.ts` kick + guard + onMounted collapse to **one unlock, one modal** `[A5]`. The router guard's `await restoreSession()` naturally parks navigation while the modal (a sibling of `router-view`) is visible.
- **Outcome handling in `_restoreSessionImpl`** (resolves conflation-of-locked-with-empty `[C5(race)]`):
  - `unlocked`/`degraded-fingerprint`/`empty` → proceed (empty falls through to `finishUnauthenticated`).
  - `storage-unavailable` → `finishUnauthenticated()` (drops `restoring`), set a retry flag; **never wipe** `[B1/P0-C]`.
  - `needs-reset`/`reset-requested` → route to Import; `finishUnauthenticated()`.
- **`ensureVaultUnlocked` never rejects** (passphrase path loops; infra path returns a status), so `restoreInFlight`/the guard/onMounted always settle and the skeleton can't hang `[A1/A2]`. `vaultReady` is reset in `finally` on infra failure so retries re-attempt `[B3]`.
- **First-persist** (`register`/`signIn`) `await ensureInitialized()` before `saveMnemonic`/`addAccountForAddress`. `ensureInitialized` is the single create-once owner of the `empty→S` transition under the lock (no lazy-create-in-sync-accessor, no double-mint) `[C2/C3]`. On a capable device it **must not silently write under the fingerprint**; if it can't persist the envelope it returns `degraded-fingerprint` and the UI surfaces reduced protection — it **never throws out of register/signIn** (so a fresh mnemonic is never lost) `[D1/C3(race)/C2(dataloss)]`.
- **Pre-unlock read audit:** `hasStoredSession()` is presence-only (no decrypt) — unchanged. All other seam readers (`recoverFromAccount`, `getMessengerKeys`, `switchAccount`, `load-account-mnemonic`, `pending-mnemonic`, `wallet-addresses`) run post-auth. `getVaultSecret()`'s throw is the **fail-safe backstop**: any stray pre-unlock read returns `{success:false}` (non-destructive), never a wrong-key decrypt. Interactive UI (account-switcher) is gated on `isAuthRestoring`, and **no mutation path runs while locked** `[H1/F]`.
- **Embed routes:** `main.ts` skips the eager kick on `meta.embed`; embeds never call `restoreSession` and never touch `S`. If a passphrase vault is ever reached with no modal host, `ensureVaultUnlocked` detects `!hostAvailable()` and resolves deterministically (`needs-reset`/unauth) rather than awaiting an unrenderable modal `[H2/C10/P1-H/A4]`.

## 7. Unlock + recovery UX

- **Passwordless (default):** one IDB read + one AES-GCM decrypt (~ms). No modal. Identical to today's brief `restoring` skeleton.
- **Passphrase boot modal:** singleton `<VaultUnlockModal>`, store-driven, **non-dismissible** (no backdrop/Esc/✕) `[B2]`. Exits are only: correct passphrase → unlocked; or **"Forgot passphrase? Restore with your 12-word recovery phrase"** → confirm → `destroyVault()`+`clearAllUserData()` → Import. While locked: dimmed public feed behind the overlay, header in skeleton.
- **Wrong-passphrase throttling** (never brick, never wipe): PBKDF2 is the natural limiter; progressive backoff persisted in `BST_VAULT_ATTEMPTS` (attempts 1–3 immediate, then 5s/15s/30s/60s cap), reload-proof, re-armed on boot. **No auto-wipe ever.** After N failures the modal proactively surfaces the recovery escape (a genuinely corrupt `ct` is indistinguishable from a wrong passphrase — both GCM-fail — so the escape must always be reachable) `[K4]`.
- **Forgotten passphrase = defined outcome:** confirm dialog states clearly that local data is cleared and only the 12 words recover it; on confirm, wipe → Import → fresh passwordless vault, logged in. Cosmetic labels (`BST_WALLET_LABELS`) don't survive — already true today. `destroyVault`/reset also clears `BST_VAULT_ATTEMPTS` `[K1]`.
- **Enabling passphrase is gated on a verified mnemonic backup** (show + re-enter) — because enabling destroys `K_device`, making forgot-passphrase = destroy `[A6/M5/P0-B]`. Dialog copy: *"If you forget this passphrase, your ONLY recovery is your 12 words."*

## 8. Test plan (happy-dom; injectable backend)

happy-dom gives real `crypto.subtle` + `navigator.locks` + `BroadcastChannel`; **no `indexedDB`/`storage.persist`** (both feature-detected). `beforeEach`: `configureVault({keyStore: createMemoryVaultKeyStore()})`; stub `navigator.storage?.persist`.

- **crypto-vault.test.ts:** `ensureInitialized` writes `BST_VAULT{mode:'device'}`, `isUnlocked()===true`; `lockVault()`+`ensureVaultReady()` recovers the **same** `S`; round-trip through **real** `encryption.ts`: `decryptData(encryptData(x,secret),secret)===x`; `enablePassphrase` → `keyStore.getKey()===null`, `kdf` present, `lockVault`, unlock-no-pw → `needs-passphrase`, `submitPassphrase('wrong')`→`{ok:false}`, correct → same `S` (a payload encrypted pre-toggle still decrypts → proves no payload re-encrypt); `disablePassphrase(pw)` → fresh key, same `S`; `destroyVault` → envelope gone, `getKey()===null`.
- **Never-brick / degrade:** `configureVault({keyStore:{throws}})` or `crypto.subtle=undefined` → `ensureVaultReady`→`degraded-fingerprint`, `getVaultSecret()===fingerprint`, register **doesn't throw**; keyStore `getKey` that never resolves → `storage-unavailable` within timeout, **non-destructive** `[B1]`.
- **vault-migration.test.ts:** seed `BST_MNEMONIC`(envelope)/`BST_ACCOUNTS_LIST`(bare)/`BST_ACCOUNT_x`(envelope) via real `encryptData(plain,'fp')` + `BST_DEVICE_FINGERPRINT='fp'`; bootstrap+migrate; assert each decrypts under `S` and **not** `'fp'`, `F` removed, originals returned. **Private-key account**: `BST_ACCOUNT_y` = WIF → migrated (not skipped as "not bip39") `[A3/P0-D]`. **Corrupt/foreign blob** → `F` retained (`allOk=false`), still readable via heal, idempotent 2nd run is a no-op. Empty payload → skipped, non-critical `[C13]`.
- **Race:** two concurrent `ensureVaultReady()` (simulating two tabs) under the lock → single `S`/single envelope; second adopts the first's envelope (no double-mint) `[A2/C2]`.
- **vault-key-store.test.ts (fake-indexeddb devDep):** real `indexedDbVaultKeyStore` round-trips a non-extractable key across a simulated reload; `exportKey` rejects; delete works; key-absent → `null` → reset path `[H4/M1(race)]`.
- **Seam tests migrated** `[G1]`: `storage-keys.test.ts`/`storage-accounts.test.ts` `vi.mock('../vault/crypto-vault', () => ({ getVaultSecret:()=>'fp', getVaultLegacyKey:()=>null }))`; add **heal-branch tests with a non-identity decrypt mock** that throws on wrong key and asserts re-save under `S` `[M2]`.

## 9. NEVER-BRICK / NEVER-LOCK-OUT guarantees (proofs)

- **Boot can't hang** — every IDB op is timeout-raced; `ensureVaultReady` always settles to a status; `finishUnauthenticated` drops `restoring` on every non-auth outcome incl. `storage-unavailable` `[B1/A1/P0-C]`.
- **Concurrent tabs can't split-brain** — bootstrap+migration+first-run S-creation+`F`-purge are serialized by `navigator.locks` (present in target webviews; localStorage-CAS fallback), with adopt-existing-envelope re-check under the lock `[A2/P0-A/C1]`.
- **Migration can't brick** — dual-key decrypt + strict plausibility + round-trip verify per payload; per-account isolation; `F` deleted last only when all verify; partial failure keeps `F` and retries next boot `[A3/B2/P0-D]`.
- **No self-inflicted quota brick** — heal write is best-effort/isolated; a failed re-key returns the decrypted data and never deletes `F` `[C4]`.
- **Corrupt envelope is recoverable** — `BST_VAULT_BACKUP` mirror + crash-proof parse; S-ciphertext with absent/corrupt envelope → recovery UI, **never** fresh-init over existing data `[A4/C5]`.
- **Enable/disable can't brick** — crash-atomic marker + write-new-before-destroy-old + verify; orphan `K_device` cleaned when passphrase wins `[P1-E/C12]`.
- **Capability gaps don't brick** — no `subtle`/insecure-context/unpersistable-IDB → `degraded-fingerprint` (works exactly as today, level 0, surfaced), register/persist never blocked, **no fresh-`S`-every-boot loop** `[D1/D2/P1-G/C3(race)]`.
- **Forgotten passphrase / evicted key = defined, non-fatal** — throttle never becomes lockout; escape hatch always reachable; mnemonic re-import restores everything `[A6/M5]`.
- **signOut revokes on-device access** — `destroyVault()` + `clearAllUserData()` wipe `BST_ACCOUNT_*` + envelope + IDB key (folds P1-12) `[D2/H3/C4(ux)]`.
- **Skeleton can't hang / modal can't wedge** — non-dismissible modal with only resolve/reset exits; `vaultReady` reset-in-finally; embed/no-host resolves deterministically `[B2/B3/H2]`.

## 10. Decision points for the product owner

1. **Passwordless first-run backup gate.** Passwordless makes seed-availability depend on IDB persistence (new vs today's localStorage-only). Options: (a) **blocking** "confirm your 12 words" at register (breaks "no UX change" but closes the eviction seed-loss path), or (b) keep register silent + `navigator.storage.persist()` + a **non-blocking** recurring Settings nudge. *Rec: (b) for default + storage.persist; a blocking backup-confirm before **enabling passphrase** is non-negotiable regardless.*
2. **KDF params.** SHA-256 vs SHA-512; iteration count (default **600k**); run PBKDF2 in a Worker? *Rec: PBKDF2-SHA256/600k, no worker (native, off-main-thread, self-tuning via envelope; revisit only if low-end Android janks).*
3. **Idle auto-lock (passphrase mode).** Default ON/OFF + timeout. A **real** lock must also clear `keyPair` (≈15 signing paths sign directly from `authStore.keyPair`), which makes unlock re-derive keys (adds seconds); otherwise auto-lock is theater `[E1]`. *Rec: ship v1 with auto-lock OFF (lock only on signOut) to avoid keyPair-rederive complexity; add real lock later if wanted.*
4. **Allow disable-passphrase?** It's a real confidentiality downgrade back to device mode. *Rec: allow, require current passphrase, explicit confirm copy.*
5. **signOut wipes `BST_ACCOUNT_*` + fingerprint now (folds P1-12)?** *Rec: yes — safe because the mnemonic restores everything.*
6. **Native Capacitor keychain-backed `VaultKeyStore` (iOS Keychain / Android EncryptedSharedPreferences via existing `@capacitor/preferences`)** — v1 or phase-2? It fixes iOS 7-day IDB eviction + is more secure than IDB. *Rec: ship the pluggable interface in v1, land the native backend as a fast-follow (strongly recommended for mobile durability).*
7. **Add `fake-indexeddb` devDep** for real-keystore test coverage (the one path carrying the security guarantee is otherwise CI-invisible)? *Rec: yes.*
8. **Out of scope, note for roadmap:** move payloads themselves from AES-CBC (unauthenticated) to AES-GCM for authenticated decryption (removes migration shape-check ambiguity); the plaintext `decryptedMessages` DM cache in `BastyonDB` is a separate confidentiality surface.
