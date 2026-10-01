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

  function texts() {
    var ru = /^(ru|uk|be|kk)\b/i.test(navigator.language || '')
    var ua = navigator.userAgent || ''
    var hint
    if (/iPhone|iPad|iPod/.test(ua)) {
      hint = ru
        ? 'Обновите iOS: Настройки → Основные → Обновление ПО.'
        : 'Update iOS: Settings → General → Software Update.'
    } else if (/Android/.test(ua)) {
      hint = ru
        ? 'Обновите «Android System WebView» и Chrome в Google Play.'
        : 'Update “Android System WebView” and Chrome in Google Play.'
    } else if (/Macintosh|Mac OS X/.test(ua)) {
      hint = ru
        ? 'Обновите Safari: меню Apple → Обновление ПО. На macOS 10.15 подойдёт последний для неё Safari 15.6.'
        : 'Update Safari: Apple menu → Software Update. On macOS 10.15 its latest Safari 15.6 is enough.'
    } else if (/Windows/.test(ua)) {
      hint = ru
        ? 'Обновите Windows и Microsoft Edge WebView2.'
        : 'Update Windows and Microsoft Edge WebView2.'
    } else {
      hint = ru
        ? 'Обновите браузер или системный пакет WebKitGTK.'
        : 'Update your browser or the system WebKitGTK package.'
    }
    return {
      title: ru ? 'Приложение не запустилось' : 'The app could not start',
      reason: ru
        ? 'Скорее всего, устарел встроенный в систему браузерный движок: нужен Safari 15 или Chromium 89 и новее.'
        : 'Most likely the system web engine is too old: Safari 15 or Chromium 89 and newer is required.',
      hint: hint,
      details: ru ? 'Подробности: ' : 'Details: ',
    }
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
