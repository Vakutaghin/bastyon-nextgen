// Обычная загрузка браузера через `<a download>`. Только для браузера: в
// приложении для компьютера WKWebView и WebKitGTK её молча отменяют, там —
// saveBlobToDevice (save-to-device.ts).

export function triggerAnchorDownload(href: string, filename: string): void {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
