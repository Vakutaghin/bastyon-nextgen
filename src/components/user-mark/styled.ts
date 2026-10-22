import styled from 'vue3-styled-components'

// Значок у аватара (проверенный, модератор, «акула») — как в старом
// приложении: точка цвета акцента с белой иконкой, здесь ещё и с кольцом
// цвета фона, в правом нижнем углу.
export const SC_UserMarkBadge = styled('span', { size: Number })`
  position: absolute;
  right: -2px;
  bottom: -2px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${(p) => p.size ?? 16}px;
  height: ${(p) => p.size ?? 16}px;
  border-radius: 50%;
  background: var(--ui-primary);
  color: var(--color-white);
  box-shadow: 0 0 0 2px var(--ui-bg);
  font-size: ${(p) => Math.max(8, Math.round((p.size ?? 16) * 0.62))}px;
  line-height: 1;

  svg {
    width: 1em;
    height: 1em;
  }
`

/** Обёртка аватара, свёрстанного обычным <img>: у самих аватаров overflow:
 *  hidden для круга, и значок внутри них обрезался бы. */
export const SC_UserMarkAnchor = styled.span`
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  vertical-align: middle;
`
