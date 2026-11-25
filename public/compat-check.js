/*
 * Экран «приложение не запустилось» вместо белого окна.
 *
 * Обычный скрипт, не модуль, и на ES5: он должен выполниться в любом движке,
 * даже если бандл в нём не разбирается (Safari 14 на macOS 10.15 не знает
 * top-level await, старый Android WebView — многого другого). Приложение
 * собрано под Safari 15 и Chromium 89 (OLDEST_ENGINES в vite.config.js).
 *
 * Если до старта приложения (флаг __bastyonBooted из src/polyfills.ts) пришла
 * ошибка из его кода, через пару секунд показывается, что обновить на этой
 * системе. Ошибки после старта — дело приложения. Таймаута без ошибки нет:
 * медленная сеть не повод говорить, что движок устарел.
 */
;(function () {
  'use strict'

  var shown = false

  function booted() {
    return window.__bastyonBooted === true
  }

  /* Тексты на всех языках приложения: словари в этот момент не загрузятся. */
  var TEXTS = {
    ru: {
      title: 'Приложение не запустилось',
      reason:
        'Скорее всего, устарел встроенный в систему браузерный движок: нужен Safari 15 или Chromium 89 и новее.',
      ios: 'Обновите iOS: Настройки → Основные → Обновление ПО.',
      android: 'Обновите «Android System WebView» и Chrome в Google Play.',
      mac: 'Обновите Safari: меню Apple → Обновление ПО. На macOS 10.15 подойдёт последний для неё Safari 15.6.',
      windows: 'Обновите Windows и Microsoft Edge WebView2.',
      linux: 'Обновите браузер или системный пакет WebKitGTK.',
      details: 'Подробности: ',
    },
    en: {
      title: 'The app could not start',
      reason:
        'Most likely the system web engine is too old: Safari 15 or Chromium 89 and newer is required.',
      ios: 'Update iOS: Settings → General → Software Update.',
      android: 'Update “Android System WebView” and Chrome in Google Play.',
      mac: 'Update Safari: Apple menu → Software Update. On macOS 10.15 its latest Safari 15.6 is enough.',
      windows: 'Update Windows and Microsoft Edge WebView2.',
      linux: 'Update your browser or the system WebKitGTK package.',
      details: 'Details: ',
    },
    de: {
      title: 'Die App konnte nicht starten',
      reason:
        'Wahrscheinlich ist die Web-Engine des Systems zu alt: Safari 15 oder Chromium 89 und neuer ist nötig.',
      ios: 'Aktualisieren Sie iOS: Einstellungen → Allgemein → Softwareupdate.',
      android: 'Aktualisieren Sie „Android System WebView“ und Chrome in Google Play.',
      mac: 'Aktualisieren Sie Safari: Apple-Menü → Softwareupdate. Unter macOS 10.15 genügt das letzte Safari 15.6.',
      windows: 'Aktualisieren Sie Windows und Microsoft Edge WebView2.',
      linux: 'Aktualisieren Sie den Browser oder das Systempaket WebKitGTK.',
      details: 'Details: ',
    },
    fr: {
      title: 'L’application n’a pas pu démarrer',
      reason:
        'Le moteur web du système est sans doute trop ancien : il faut Safari 15 ou Chromium 89, ou plus récent.',
      ios: 'Mettez iOS à jour : Réglages → Général → Mise à jour logicielle.',
      android: 'Mettez à jour « Android System WebView » et Chrome dans Google Play.',
      mac: 'Mettez Safari à jour : menu Apple → Mise à jour de logiciels. Sur macOS 10.15, son dernier Safari 15.6 suffit.',
      windows: 'Mettez à jour Windows et Microsoft Edge WebView2.',
      linux: 'Mettez à jour votre navigateur ou le paquet système WebKitGTK.',
      details: 'Détails : ',
    },
    es: {
      title: 'La aplicación no pudo iniciarse',
      reason:
        'Lo más probable es que el motor web del sistema sea demasiado antiguo: se necesita Safari 15 o Chromium 89 o posterior.',
      ios: 'Actualice iOS: Ajustes → General → Actualización de software.',
      android: 'Actualice «Android System WebView» y Chrome en Google Play.',
      mac: 'Actualice Safari: menú Apple → Actualización de software. En macOS 10.15 basta con su último Safari 15.6.',
      windows: 'Actualice Windows y Microsoft Edge WebView2.',
      linux: 'Actualice el navegador o el paquete WebKitGTK del sistema.',
      details: 'Detalles: ',
    },
    it: {
      title: 'Impossibile avviare l’app',
      reason:
        'Probabilmente il motore web del sistema è troppo vecchio: serve Safari 15 o Chromium 89 o versioni successive.',
      ios: 'Aggiorna iOS: Impostazioni → Generali → Aggiornamento software.',
      android: 'Aggiorna «Android System WebView» e Chrome su Google Play.',
      mac: 'Aggiorna Safari: menu Apple → Aggiornamento Software. Su macOS 10.15 basta il suo ultimo Safari 15.6.',
      windows: 'Aggiorna Windows e Microsoft Edge WebView2.',
      linux: 'Aggiorna il browser o il pacchetto di sistema WebKitGTK.',
      details: 'Dettagli: ',
    },
    sr: {
      title: 'Апликација није могла да се покрене',
      reason:
        'Највероватније је веб-механизам система застарео: потребан је Safari 15 или Chromium 89 и новији.',
      ios: 'Ажурирајте iOS: Подешавања → Опште → Ажурирање софтвера.',
      android: 'Ажурирајте „Android System WebView“ и Chrome у Google Play-у.',
      mac: 'Ажурирајте Safari: Apple мени → Ажурирање софтвера. На macOS 10.15 довољан је његов последњи Safari 15.6.',
      windows: 'Ажурирајте Windows и Microsoft Edge WebView2.',
      linux: 'Ажурирајте прегледач или системски пакет WebKitGTK.',
      details: 'Детаљи: ',
    },
    kr: {
      title: '앱을 시작할 수 없습니다',
      reason:
        '시스템 웹 엔진이 너무 오래된 것 같습니다. Safari 15 또는 Chromium 89 이상이 필요합니다.',
      ios: 'iOS를 업데이트하세요: 설정 → 일반 → 소프트웨어 업데이트.',
      android: 'Google Play에서 “Android System WebView”와 Chrome을 업데이트하세요.',
      mac: 'Safari를 업데이트하세요: Apple 메뉴 → 소프트웨어 업데이트. macOS 10.15에서는 마지막 Safari 15.6이면 충분합니다.',
      windows: 'Windows와 Microsoft Edge WebView2를 업데이트하세요.',
      linux: '브라우저 또는 시스템의 WebKitGTK 패키지를 업데이트하세요.',
      details: '자세한 내용: ',
    },
    zh: {
      title: '应用无法启动',
      reason: '很可能是系统的网页引擎过旧：需要 Safari 15 或 Chromium 89 及以上版本。',
      ios: '请更新 iOS：设置 → 通用 → 软件更新。',
      android: '请在 Google Play 中更新“Android System WebView”和 Chrome。',
      mac: '请更新 Safari：苹果菜单 → 软件更新。在 macOS 10.15 上，其最后的 Safari 15.6 即可。',
      windows: '请更新 Windows 和 Microsoft Edge WebView2。',
      linux: '请更新浏览器或系统的 WebKitGTK 软件包。',
      details: '详细信息：',
    },
  }

  /* Язык, выбранный в приложении, иначе язык системы; коды — как в src/i18n. */
  function language() {
    var saved = null
    try {
      saved = localStorage.getItem('bastyon_locale')
    } catch (e) {
      // хранилище закрыто — по языку системы
    }
    if (saved && TEXTS.hasOwnProperty(saved)) return saved
    var code = String(navigator.language || '')
      .split('-')[0]
      .toLowerCase()
    if (/^(uk|be|kk)$/.test(code)) return 'ru'
    if (code === 'ko') return 'kr'
    return TEXTS.hasOwnProperty(code) ? code : 'en'
  }

  function texts() {
    var t = TEXTS[language()]
    var ua = navigator.userAgent || ''
    var hint = t.linux
    if (/iPhone|iPad|iPod/.test(ua)) hint = t.ios
    else if (/Android/.test(ua)) hint = t.android
    else if (/Macintosh|Mac OS X/.test(ua)) hint = t.mac
    else if (/Windows/.test(ua)) hint = t.windows
    return { title: t.title, reason: t.reason, hint: hint, details: t.details }
  }

  function show(detail) {
    if (shown || booted() || !document.body) return
    shown = true
    var t = texts()
    var box = document.createElement('div')
    box.setAttribute('role', 'alert')
    box.style.cssText =
      'position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483647;display:flex;' +
      'align-items:center;justify-content:center;padding:24px;background:#fff;color:#111;' +
      'font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;text-align:center'
    var inner = document.createElement('div')
    inner.style.cssText = 'max-width:520px'
    var lines = [
      ['h1', t.title, 'margin:0 0 12px;font-size:22px'],
      ['p', t.reason, 'margin:0 0 12px'],
      ['p', t.hint, 'margin:0 0 12px;font-weight:600'],
    ]
    if (detail) lines.push(['p', t.details + detail, 'margin:0;color:#666;font-size:13px'])
    for (var i = 0; i < lines.length; i++) {
      var el = document.createElement(lines[i][0])
      el.textContent = lines[i][1]
      el.style.cssText = lines[i][2]
      inner.appendChild(el)
    }
    box.appendChild(inner)
    document.body.appendChild(box)
  }

  function showSoon(detail) {
    // Пара секунд: вдруг ошибка не помешала приложению стартовать.
    setTimeout(function () {
      show(detail)
    }, 2000)
  }

  window.addEventListener('error', function (event) {
    if (shown || booted() || !event || !event.message) return
    // Только ошибки страницы приложения: не расширений браузера и не чужих фреймов.
    // Не location.origin: у tauri://localhost (Tauri на macOS) он бывает "null".
    var file = event.filename || ''
    if (file && file.indexOf(location.protocol + '//' + location.host) !== 0) return
    showSoon(String(event.message))
  })

  // Движок не знает модулей вовсе: бандл молча не загрузится, ошибки не будет.
  if (!('noModule' in document.createElement('script'))) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        show('')
      })
    } else {
      show('')
    }
  }
})()
