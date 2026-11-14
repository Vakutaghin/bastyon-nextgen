import {
  cloneVNode,
  Comment,
  Fragment,
  shallowRef,
  Text,
  type ComponentPublicInstance,
  type VNode,
} from 'vue'

/**
 * Кнопка панели — сам элемент из слота, как у antd: подсказка, меню и панель
 * не оборачивают его своим узлом, а вешают обработчики и aria на него. Так не
 * ломаются раскладка и селекторы родителя (`> button`).
 */

/** Первый настоящий узел слота: без комментариев от v-if и пустого текста. */
export function firstElementVNode(nodes: VNode[] | undefined): VNode | null {
  for (const node of nodes ?? []) {
    if (node.type === Comment) continue
    if (node.type === Text && !String(node.children ?? '').trim()) continue
    if (node.type === Fragment && Array.isArray(node.children)) {
      const inner = firstElementVNode(node.children as VNode[])
      if (inner) return inner
      continue
    }
    return node
  }
  return null
}

/** Элемент кнопки: ref на элемент или на компонент (его корень). */
export function useTriggerElement() {
  const el = shallowRef<HTMLElement | null>(null)

  function setRef(value: Element | ComponentPublicInstance | null): void {
    const node =
      value && '$el' in (value as ComponentPublicInstance)
        ? (value as ComponentPublicInstance).$el
        : value
    el.value = node instanceof HTMLElement ? node : null
  }

  /**
   * Узел кнопки с добавленными свойствами (обработчики сливаются с её
   * собственными, ref потребителя сохраняется). Без узла в слоте — ничего.
   */
  function render(nodes: VNode[] | undefined, props: Record<string, unknown>): VNode | null {
    const node = firstElementVNode(nodes)
    if (!node) return null
    return cloneVNode(node, { ...props, ref: setRef }, true)
  }

  return { el, render }
}
