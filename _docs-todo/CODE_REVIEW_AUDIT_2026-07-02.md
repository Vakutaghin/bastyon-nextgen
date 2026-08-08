# Ревью bastyon-nextgen — оставшиеся открытые проблемы

> Исходное ревью: **2026-07-02**. Актуализировано: **2026-08-05** (закрытые пункты удалены).
> Объект: `bastyon-nextgen` (Vue 3 + TS, self-custody, мнемоника-only).
>
> **Закрыто и снято из списка:** все P0 (1–4), все P1 (1–13), P2 (1,2,3,6,7,8,9,10,12,13), P3-6 —
> подтверждено коммитами аудита (`fad220c` P0, P1-проход) и текущим кодом. Детали фиксов — в git-истории
> и `_docs-todo/P0-1_VAULT_PLAN.md` (сейф сида).
>
> **Осталось: 8 находок** — 🟡 P2: 3 · ⚪ P3: 5. Все ссылки — от корня `bastyon-nextgen/`.

---

## 🟡 P2 — средний. Логика транзакций/крипто. Требуют живой/кросс-клиентной верификации.

> Отложены осознанно: правки нельзя достоверно проверить в dev-окружении — нужна живая нода
> (реальная value-tx / трата средств) или кросс-клиентный round-trip (wire-формат).

- [ ] **P2-4 · Оплата mini-app игнорирует `feemode: 'include'`: мёртвый тернарник шлёт полную сумму и недофинансирует tx** — ⏸️ **ОТЛОЖЕНО (нужна живая проверка)**
  `logic · conf: high` 📁 [mini-app-payment-modal.vue:126](bastyon-nextgen/src/mini-apps/ui/mini-app-payment-modal.vue#L126)
  При `include` (комиссию платит получатель) выход получателя всё равно = полная сумма (`feemode === 'include' ? r.amount : r.amount` — обе ветки идентичны). **Фикс:** при `include`
  вычитать комиссию из выхода получателя. **Отложено:** правка сборки реальной value-tx — проверять на живой ноде.

- [ ] **P2-5 · Value-transfer не лочит выбранные UTXO (в отличие от контент-флоу) → double-spend / тихий провал второй tx** — ⏸️ **ОТЛОЖЕНО (нужна живая проверка)**
  `logic · conf: medium` 📁 [mini-app-payment-modal.vue:114](bastyon-nextgen/src/mini-apps/ui/mini-app-payment-modal.vue#L114)
  **Фикс:** лочить UTXO на время оплаты, как в контент-флоу. **Отложено:** трата реальных средств — проверять живьём.

- [ ] **P2-11 · Групповые сообщения: AES-CBC с фиксированным IV под долгоживущим переиспользуемым ключом комнаты** — ⏸️ **ОТЛОЖЕНО (нужна кросс-клиентная проверка)**
  `security · conf: medium (messenger)` 📁 [encryption-service.ts:99](bastyon-nextgen/src/b-components/messenger/services/encryption-service.ts#L99)
  Детерминированный CBC (тот же ключ + константный IV из `consts.AES_CBC_IV`): одинаковые block-aligned префиксы дают одинаковый
  шифропрефикс → homeserver детектит повторы/шаблоны и подтверждает угаданный plaintext. **Фикс:** свежий
  случайный IV на сообщение (префиксом к шифротексту) или AES-GCM/SIV для тел групповых сообщений.
  **Отложено:** меняет wire-формат групповых сообщений — обязателен кросс-клиентный round-trip (forta/legacy), иначе рискуем сломать расшифровку.

---

## ⚪ P3 — низкий. Гигиена, tooling, UX-деградации, defense-in-depth.

- [ ] **P3-1 · Нет CI-гейта (тесты/линт/typecheck), билд не тайпчекает → сломанные релизы могут уехать**
  `quality · conf: high` 📁 [.github/workflows/release.yml:31](bastyon-nextgen/.github/workflows/release.yml#L31)
  **Фикс:** job с `pnpm lint && vitest run && vue-tsc --noEmit` как required-гейт до сборки/релиза.

- [ ] **P3-2 · Failed-to-decrypt зашифрованный DM рендерит сырой шифротекст вместо плейсхолдера**
  `logic · conf: high (messenger)` 📁 [use-message-mapping.ts:136](bastyon-nextgen/src/b-components/messenger/store/messenger-chat-store/use-message-mapping.ts#L136)
  `ENCRYPTED_MESSAGE_PLACEHOLDER` уже частично внедрён (group-encrypted и пустой-text пути), но остаётся ветка
  `text = content.body || ENCRYPTED_MESSAGE_PLACEHOLDER` — при непустом `content.body` (шифротекст legacy-формата)
  сырой текст ещё может просочиться. **Фикс:** для encrypted-type/secrets-сообщений при сбое дешифровки — всегда `ENCRYPTED_MESSAGE_PLACEHOLDER`.

- [ ] **P3-3 · Нет sender-key continuity / device verification (TOFU/MITM-зазор)**
  `security · conf: low (messenger)` 📁 [use-message-decryption.ts:150](bastyon-nextgen/src/b-components/messenger/store/messenger-chat-store/use-message-decryption.ts#L150)
  Ключи пиров тянутся из on-chain профиля через RPC без пиннинга/предупреждения о смене → вредоносная нода может
  подменить ключ (MITM на новых диалогах). Частично присуще модели доверия ноде. **Фикс:** пиннинг ключа пира при
  первом использовании + предупреждение при смене.

- [ ] **P3-4 · Приватный ключ логируется при ошибке конверсии**
  `security · conf: low (messenger)` 📁 [pcrypto.ts:120](bastyon-nextgen/src/b-components/messenger/services/pcrypto.ts#L120)
  В `catch` печатается сырой `privateKey` (`console.error('[Pcrypto] Failed to convert private key to hex', privateKey)`). Узкий триггер, но материал ключа в консоли. **Фикс:** убрать значение
  из лога.

- [ ] **P3-5 · Tauri-фича `devtools` включена безусловно → инспектор вебвью едет в release-сборке**
  `security · conf: high` 📁 [src-tauri/Cargo.toml:24](bastyon-nextgen/src-tauri/Cargo.toml#L24)
  `features = ["protocol-asset", "devtools"]` — devtools не гейтится профилем. **Фикс:** `devtools` только в dev-профиле/`#[cfg(debug_assertions)]`.

---

## Сводные рекомендации по порядку работ

1. **P3-1 (CI-гейт)** — поднять первым, независимо от формального приоритета: без него регрессии по остальным
   пунктам будут утекать в релизы. Дёшево, разблокирует безопасное внедрение прочих фиксов
   (`pnpm lint && vitest run && vue-tsc --noEmit`).
2. **P2-4 / P2-5** (крипто/tx) — фиксить совместно с живыми tx-прогонами на ноде (см.
   `_docs-todo/POST_COMPOSER_PORT_PLAN.md`): недофинансирование при `feemode:include` и UTXO-лок.
3. **P2-11** — свежий IV/AES-GCM для групповых сообщений; обязателен кросс-клиентный round-trip (forta/legacy)
   перед выкаткой, т.к. меняется wire-формат.
4. **Мессенджер-гигиена (P3-2/P3-3/P3-4)** — placeholder на сбой дешифровки, пиннинг ключа пира, чистка лога ключа.

> **Оговорка по доверию.** Мессенджер-находки (P2-11, P3-2…P3-4) проверялись одиночным проходом. Severity —
> консервативная. Перед фиксом каждую перечитать в текущем коде: репозиторий активно меняется.
