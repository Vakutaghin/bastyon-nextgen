/**
 * Куда antd рисует выпадающую панель поля (список Select, календарь): внутри
 * слоя с `data-popup-host` (корни своих окон, шторок и панелей из ui-core,
 * меню телефона) — в нём, иначе в body. В body панель на 1050 открывалась бы
 * под окном.
 */
export function popupContainer(trigger: HTMLElement): HTMLElement {
  return trigger.closest<HTMLElement>('[data-popup-host]') ?? document.body
}
