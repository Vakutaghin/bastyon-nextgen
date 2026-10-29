import { nextTick, onMounted, toValue, watch, type WatchSource } from 'vue'

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
  // Пустое поле и так своей высоты (rows), мерить нечего. Замер — это
  // перекладка всей страницы, а поле комментария есть в каждой карточке
  // ленты: на первой отрисовке ленты на замеры уходила пятая часть времени.
  onMounted(() => {
    if (toValue(text)) fit()
  })
  return fit
}
