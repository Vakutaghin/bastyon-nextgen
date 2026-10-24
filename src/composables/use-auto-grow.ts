import { nextTick, onMounted, watch, type WatchSource } from 'vue'

/**
 * Поле ввода растёт с текстом: высота — по содержимому, предел — max-height в
 * стилях поля, дальше прокрутка. Пересчёт — при монтировании и при любой смене
 * текста, в том числе снаружи: эмодзи, восстановленный черновик, очистка после
 * отправки.
 *
 * @returns пересчитать высоту сейчас
 */
export function useAutoGrow(
  textarea: () => HTMLTextAreaElement | null,
  text: WatchSource<string>
): () => void {
  function fit(): void {
    const el = textarea()
    if (!el) return
    el.style.height = 'auto'
    // scrollHeight — без рамки, а высота поля (border-box) — с ней.
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
  }

  watch(text, () => void nextTick(fit))
  onMounted(fit)
  return fit
}
