// Отдать главный поток браузеру между кусками тяжёлой синхронной работы:
// между ними успевают пройти нажатия и отрисовка. scheduler.yield там, где он
// есть (Chromium 129+), иначе макрозадача через MessageChannel: setTimeout(0)
// после пяти вложений браузер зажимает до 4 мс.

type YieldingScheduler = { yield?: () => Promise<void> }

let channel: MessageChannel | null = null
const waiting: Array<() => void> = []

function viaChannel(): Promise<void> {
  if (!channel) {
    channel = new MessageChannel()
    channel.port1.onmessage = () => waiting.shift()?.()
    // Node (тесты): открытый порт иначе не даёт процессу завершиться.
    ;(channel.port1 as { unref?: () => void }).unref?.()
  }
  return new Promise((resolve) => {
    waiting.push(resolve)
    channel!.port2.postMessage(null)
  })
}

export function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: YieldingScheduler }).scheduler
  if (typeof scheduler?.yield === 'function') return scheduler.yield()
  if (typeof MessageChannel === 'function') return viaChannel()
  return new Promise((resolve) => setTimeout(resolve, 0))
}
