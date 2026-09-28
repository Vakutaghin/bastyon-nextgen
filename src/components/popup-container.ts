/**
 * Куда antd рисует выпадающую панель поля (список Select, календарь). Внутри
 * модалки — в её обёртку: у модалок z-index 2700 и выше, а панель в body живёт
 * на 1050 и открывалась бы под окном.
 */
export function popupContainer(trigger: HTMLElement): HTMLElement {
  return trigger.closest<HTMLElement>('.ant-modal-wrap') ?? document.body
}
