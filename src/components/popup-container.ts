/**
 * Куда antd рисует выпадающую панель поля (список Select, календарь). Внутри
 * модалки — в её обёртку: у модалок z-index 2700 и выше, а панель в body живёт
 * на 1050 и открывалась бы под окном. Так же — внутри слоя с `data-popup-host`
 * (меню телефона на 1101).
 */
export function popupContainer(trigger: HTMLElement): HTMLElement {
  return trigger.closest<HTMLElement>('.ant-modal-wrap, [data-popup-host]') ?? document.body
}

/**
 * Куда antd рисует выпадашки закреплённой шапки (уведомления, Tor, меню
 * профиля). В body панель стоит в координатах страницы: страница прокрутилась
 * под открытой панелью — например, колесо над мини-чатом дошло до края
 * переписки и листает ленту — и панель уезжала вместе с лентой, а шапка
 * оставалась на месте. Слой закреплён, как шапка, и панель не отходит от своей
 * кнопки. Слой свой на каждый `zIndex`: панель стоит на том же уровне, что
 * стояла в body, — над мессенджером, но не выше, чем прежде.
 */
export function fixedPopupLayer(zIndex: number): HTMLElement {
  const id = `fixed-popup-layer-${zIndex}`
  const found = document.getElementById(id)
  if (found) return found
  const layer = document.createElement('div')
  layer.id = id
  layer.style.cssText = `position:fixed;top:0;left:0;width:0;height:0;z-index:${zIndex}`
  document.body.appendChild(layer)
  return layer
}
