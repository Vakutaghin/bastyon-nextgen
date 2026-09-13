## Зона: D — композер поста / санитизация контента / картинки / загрузка видео (PeerTube) / видеоплеер

### Находки
- **D1 · 🔴 критично · security** — Обход санитайзера: `bastyon://`/`ipfs://`/`ipns://` href возвращается без экранирования → инъекция произвольных атрибутов в `<a>`
  - Файл: `src/helpers/content/sanitize-html.ts:70-79`; сток: `text-formatter.ts:108,127` → v-html в `post-card-content.vue:12-24`, `comment-card.vue:83`, `last-comment-preview.vue:18,101`, всех `block-content/blocks/*`.
  - Суть: кастомный `safeAttrValue` делает `return value` для «своих» схем, минуя `escapeAttrValue`. `xss` собирает атрибут как `name="value"`, кавычка закрывает `href`, остальное — новые атрибуты. Автолинкер не спасает: `bastyon://"` не матчится его регэкспом.
  - Сценарий (проверено запуском): `<a href='bastyon://" onmouseover="alert(1)'>hover</a>` → `<a href="bastyon://" onmouseover="alert(1)">`; `<a href='bastyon://" style="position:fixed;inset:0;z-index:2147483647;background:#fff'>x</a>` → у каждого читателя экран накрыт слоем (клик-джекинг/DoS), `style-src 'unsafe-inline'` разрешает. Исполнение `on*` блокирует только meta-CSP из `index.html` (в Tauri meta остаётся); `tauri.conf.json` явно разрешает `'unsafe-inline'`. Если meta уедет — RCE-уровень (keyPair в Pinia, `invoke`, см. D2).
  - Фикс: `return escapeAttrValue(value)` (экспортируется из `xss`) в ветке своих схем. Тест `text-formatter.test.ts:21` останется зелёным.
  - Уверенность: high.

- **D2 · 🟠 высоко · security** — Tauri-команды с произвольными путями без валидации; `read_file` вообще не используется фронтом
  - Файл: `src-tauri/src/lib.rs:37-50` (`save_temp_file`), `:56-60` (`delete_temp_file`), `:118-121` (`read_file`), `:154-171` (`get_video_metadata`), `:284-316` (`transcode_video`, `output_path` от фронта), `:618-624`; `build.rs` без `app_manifest` — app-команды не гейтятся ACL; вызовы `tauri-transcoder.ts:89,196,243-246,271`.
  - Сценарий: любой JS в главном окне (D1 без meta-CSP, escape из mini-app) → `invoke('read_file',{filePath:'~/.ssh/id_rsa'})`, `invoke('delete_temp_file',{filePath:'/Users/x/Documents/…'})`, `invoke('transcode_video',{…, outputPath:'~/Library/LaunchAgents/x.plist'})`.
  - Фикс: удалить `read_file`; в `delete_temp_file` канонизировать путь и принимать только `temp_dir()/tauri_(video|output)_*`; в `transcode_video` игнорировать `output_path` от фронта и валидировать `input_path` префиксом.
  - Уверенность: high.

- **D3 · 🟠 высоко · security** — Mini-app `videos.remove` заставляет клиент пройти `blockChainAuth` на хосте из указателя, который контролирует mini-app → утечка свежей подписи и захват PeerTube-аккаунта
  - Файл: `src/mini-apps/actions/media.ts:53-63`, `host-context-methods/media-upload.ts:23-32`, `peertube-videos.ts:196-210`, `peertube-auth.ts:108-116,204-226`, `peertube-instance.ts:25-28`, `api-signature.ts:59`; `mini-apps/actions/registry.ts:99` (`authorization` = только «залогинен»).
  - Суть: `removeVideoByPointer` берёт `host` из `peertube://host/id` → `POST https://<host>/api/v1/users/blockChainAuth` с подписью, nonce `date=…,exp=360,s=hex('peertube')` не привязан к хосту. Хост-«приёмник» переигрывает подпись на настоящем инстансе в течение 6 минут и получает access+refresh token жертвы.
  - Сценарий: mini-app вызывает `videos.remove({url:'peertube://evil.example/x'})`. В веб/Capacitor и в Tauri с Tor (`tor_fetch` без скоупа) запрос уходит; в Tauri без Tor режет скоуп plugin-http.
  - Фикс: разрешать только хосты из списка ноды или по маске платформенных инстансов; консент-диалог для `videos.remove`.
  - Уверенность: high.

- **D4 · 🟠 высоко · data** — Редактирование теряет `url` (видео/аудио), `settings` (видимость `f`, `v`) и `language`; легаси `Share.import` их сохраняет
  - Файл: `composer-source.ts:12-29,77-85`, `use-post-composer.ts:77-93,116,145-148,167-191`, `post-card.vue:288-290`; эталон `kit.js:1766-1772`.
  - Сценарий: (а) «Редактировать» видеопост → `txidEdit` с `u:''` и operationType `share` вместо `video` → пост лишится видео; (б) пост «только подписчикам» (`f:'1'`) после правки опечатки → `f:'0'` — публичный; (в) русский пост при UI en → `l:'en'`.
  - Фикс: расширить `ComposerSource`/`postToComposerData` полями `url`, `settings`, `language`; в edit-режиме инициализировать из источника.
  - Уверенность: high.

- **D5 · 🟠 высоко · logic** — Tauri-транскод: файл > 100 МБ падает детерминированно (`RangeError`), а 5–100 МБ гонятся через `number[]`-JSON IPC
  - Файл: `file-worker.ts:26-30` (`result.push(...Array.from(chunk))`, chunk 100 МБ), `tauri-transcoder.ts:255-280,286-333`, `lib.rs:37` (`Vec<u8>` из JSON), лимит UI 500 МБ `use-upload-state.ts:49`.
  - Сценарий: видео 150 МБ → «Начать загрузку» → `FILE_SAVE_ERROR` всегда; 5–100 МБ → ~8–10× памяти.
  - Фикс: raw-тело `invoke` (`tauri::ipc::Request`) чанками, либо path из dialog-плагина без копирования (P1 плана).
  - Уверенность: high (воспроизведён `RangeError`).

- **D6 · 🟠 высоко · security** — OAuth-токены PeerTube (access+refresh) в localStorage и не удаляются при выходе
  - Файл: `peertube-auth.ts:50-72` (`token_<address>_<host>`), `storage-manager.ts:82-117`, `auth-store.ts:322-347`; аналогично `resumable_*` (`peertube-upload.ts:128-159`) и `bastyon_post_draft`.
  - Сценарий: вышел на общем ПК → следующий читает `localStorage.token_<addr>_<host>` → refresh → удаляет/заливает видео от имени жертвы.
  - Фикс: в `clearAllUserData` удалять по префиксам `token_`, `resumable_`, `bastyon_post_draft`; идеально — токены в памяти/сейфе.
  - Уверенность: high.

- **D7 · 🟡 средне · logic** — Глобальный хоткей Space/M (capture + `stopPropagation`) съедает Space на кнопках/селектах после первого запуска видео (= A16)
  - Файл: `use-global-keyboard.ts:12-33,51-58,105`; `use-video-hotkeys.ts:10,48`.
  - Фикс: учитывать `BUTTON/SELECT/A/[role=button]`, либо оставить один обработчик в плеере.

- **D8 · 🟡 средне · logic** — Автолинкер ломает инлайн `<a href="https://…">` и `<img src="https://…">` в HTML-контенте
  - Файл: `text-formatter.ts:55-56,113-127`.
  - Сценарий (проверено): `see <a href="https://example.com/page">my site</a>` → `<a href>my site</a>`; `<img src="https://pocketnet.app:8092/i/abc.jpg">` → `<img src>`.
  - Фикс: линкифицировать только текстовые ноды (TreeWalker как для тайм-кодов), либо пропускать сегменты внутри `<…>`.
  - Уверенность: high/medium.

- **D9 · 🟡 средне · consistency** — Два рендерера одного Editor.js-JSON расходятся: превью статьи и полный вид показывают разное
  - Файл: `block-content.vue:47-60` (decode, нет `delimiter`, есть `link/table`) vs `editorjs-parser.ts:134-160` (нет decode, нет `link/table`, есть `delimiter`).
  - Сценарий: `delimiter` в превью `<hr>`, в полном виде пустой `<p>`; `%D0…` в превью сырой; `table` в превью исчезает; list-объекты v2 → `[object Object]`.
  - Фикс: один рендерер (BlockContent) + `BlockDelimiter`; маппинг в одном модуле.

- **D10 · 🟡 средне · race/leak** — `initPlayer` реэнтерабелен, слушатели `<video>` копятся на каждой (пере)инициализации
  - Файл: `video-player.vue:637-649,692`, `use-video-hls.ts:221-349`, `use-video-element-events.ts:45-93`, `hls-initializer.ts:36-60`.
  - Фикс: промис инициализации; листенеры один раз или через `AbortController.signal`.

- **D11 · 🟡 средне · leak** — Отмена транскода в Tauri не убивает ffmpeg
  - Файл: `tauri-transcoder.ts:338-340` (`destroy()` no-op), `use-upload-state.ts:270-285`, `lib.rs` — команды cancel нет. Фаза G в `VIDEO_UPLOAD_CHECKLIST.md:114` помечена DONE.
  - Фикс: `Child` в `tauri::State`, команда `cancel_transcode`.

- **D12 · 🟡 средне · logic** — Кнопки ±10 с на lock screen перематывают от позиции момента `claim()`, а не от текущей
  - Файл: `background-media-controller.ts:68-106,142-156`; `use-background-playback.ts:151-158`.
  - Фикс: читать `sessionPayload?.position`/`currentTime` в момент вызова.

- **D13 · 🟡 средне · race** — Модалку композера можно закрыть во время публикации → черновик жив → повторная публикация даёт дубль
  - Файл: `post-composer-modal.vue:8-16`, `use-post-composer.ts:261-316`, `post-draft.ts:13-20`.
  - Фикс: `closable=false` при `submitting`; черновик чистить перед отправкой, восстанавливать при ошибке.
  - Уверенность: medium (60-секундный лок UTXO может прикрыть).

- **D14 · 🟡 средне · leak** — Аудио-визуализатор не закрывает `AudioContext`; ремонт после retry молча ломает визуализацию
  - Файл: `use-audio-visualizer.ts:24,53-89,167-171`; `video-player.vue:33-37`.
  - Фикс: модульный `WeakMap<HTMLMediaElement,{ctx,source}>`, `audioContext.close()` в `onBeforeUnmount`.

- **D15 · 🟡 средне · ux-claim** — Медиа-трафик зоны идёт мимо Tor (= B3/H1): `use-video-subtitles.ts:52` raw fetch, `download-media.ts:36,45`, `use-video-thumbnail.ts:30-40` → `<img>`, hls.js XHR на `https://<host>` из `peertube://host/id`, iframes YouTube/Vimeo.
  - Сценарий: пост с `peertube://evil-host/…` → превью при монтировании карточки → хост автора видит IP каждого читателя.

- **D16 · 🟡 средне · consistency** — Два разных парсера YouTube: композер обещает превью, которого в ленте не будет; Vimeo только в композере (и в Tauri блокируется CSP)
  - Файл: `parse-video-url.ts:24-35,61-68` vs `youtube-url.ts:5-6` (`use-post-media.ts:27-28`); `tauri.conf.json` `frame-src` без `player.vimeo.com`.
  - Сценарий (проверено): `youtube.com/shorts/<id>` — превью в композере есть, в ленте нет; ссылка с `.`/`,` в хвосте — композер кладёт `https://youtu.be/ID.`.
  - Фикс: общий экстрактор ID.

- **D17 · 🟡 средне · logic** — macOS: `Command::new("ffmpeg")` ищет по PATH GUI-процесса, где Homebrew нет
  - Файл: `lib.rs:135-136,161,318`.
  - Сценарий: brew ffmpeg, запуск из Dock → «установите ffmpeg»; из терминала работает.
  - Фикс: `fix-path-env::fix()` или перебор `/opt/homebrew/bin`, `/usr/local/bin`.
  - Уверенность: medium.

- **D18 · ⚪ низко · ux-claim** — `bastyon://`-ссылки в постах рендерятся как «внутренние», но клик по ним никто не обрабатывает
  - Файл: `text-formatter.ts:83-85`, `sanitize-html.ts:75`; делегаты только для `.mention-link` (`app-layout.vue:46-56`) и IPFS.
  - Фикс: делегат `a.bastyon-link` → `parseBasytonLink` → `router.push`.

- **D19 · ⚪ низко · data** — Черновик поста один на устройство (= A17).

- **D20 · ⚪ низко · logic** — Enter в поле тегов подставляет первую подсказку вместо набранного слова
  - Файл: `composer-tags.vue:118,151-155` (`activeIndex=0`).
  - Фикс: `activeIndex=-1`; Enter коммитит ввод.

- **D21 · ⚪ низко · ux-claim** — Аплоадер называет транскод «загрузкой», wasm-путь недостижим из UI
  - Файл: `ru.ts:1044-1082`, `use-upload-state.ts:183-206`, `fab-button.vue:3` (`v-if="isTauriEnv"`), `video-uploader.vue:185-189`.
  - Фикс: переименовать состояния; либо FAB в вебе, либо не инициализировать транскодер вне Tauri.

### Несостыковки между модулями
- **D22 · ⚪** — `video-player/store.ts` (`useVideoPlayerStore`) — мёртвый дубликат `video-player-manager.ts` (экспортируется из `stores/index.ts`, никем не используется). Удалить.
- **D23 · ⚪** — Два `normalizeImageUrl` (`url-transformer.ts:16` — домен; `image-upload-service.ts:32` — `https://`); третий `escapeHtml` в `text-formatter.ts:6` при `html-escape.ts:10`.
- **D24 · ⚪** — Hex-капча: `captcha.vue:12` `ref="captchaImageRef"`, но переменная не объявлена → ref composable'а (`captcha.ts:85,104`) не заполняется → при `captcha.hex` UI пустой. Сейчас мёртвый путь.
- **D25 · ⚪** — Хоткеи: `use-video-hotkeys.ts` и `use-global-keyboard.ts` обрабатывают Space/M по разным правилам; второй всегда выигрывает.

### Проверено — ОК
- Штатные фильтры `xss`: `javascript:`, entity-обфускация, `data:` в href режутся; `<script>/<style>` вырезаются; `on*` убираются (прогон).
- `editorjs-parser.ts`: `src`/`alt` экранируются; `parseCode` экранирует.
- `block-link.vue` `toSafeHref` allowlist корректен; `block-image.vue` только `<img src>`.
- Внешние ссылки `target=_blank rel="noopener noreferrer"`; меншены `[A-Za-z0-9_]`.
- Капча: SVG через `data:`-URI в `<img>`. Changelog: HTML из `changelogs/*.desc.md` на сборке.
- `resize-image.ts`: canvas снимает EXIF (кроме GIF).
- `image-upload-service.ts`: платформенный аккаунт как в легаси; `uploadImage` пропускает уже-URL.
- `validate-post.ts` соответствует `kit.js`; `serializePost/exportPost` побайтно совпадают.
- `post-sender.ts`: локи UTXO TTL 60 с; `canPublish` гейтит двойной клик.
- `peertube-upload.ts`: чанки по 256, резюм TTL 12 ч, ретраи ограничены, отмена с DELETE; 401-retry.
- `transcoded-video-api.ts`: лимиты 500 МБ / 50 / 30 дней; Rust sweep осиротевших temp.
- Плеер: `hls.destroy()` на unmount/retry; listeners снимаются; `hls-error-recovery` ограничен.
- Tauri capabilities: plugin-http скоупирован; asset-протокол ограничен.
- i18n: все 164 ключа зоны есть в ru/en.
