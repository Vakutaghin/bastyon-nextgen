import styled from 'vue3-styled-components'

// Значок у аватара (проверенный, модератор, «акула»), как в старом приложении,
// но в левом верхнем углу: правый нижний — место точки «в сети», и в чатах
// значок за неё принимали. У каждой отметки свой цвет (--ui-mark-* в
// style.css), иконка контрастная к заливке, кольцо цвета фона отделяет значок
// от фото.
export const SC_UserMarkBadge = styled('span', { size: Number })`
  position: absolute;
  top: -2px;
  left: -2px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${(p) => p.size ?? 16}px;
  height: ${(p) => p.size ?? 16}px;
  border-radius: 50%;
  background: var(--ui-mark-verified);
  color: var(--ui-mark-verified-on);
  box-shadow: 0 0 0 2px var(--ui-bg);
  font-size: ${(p) => Math.max(9, Math.round((p.size ?? 16) * 0.66))}px;
  line-height: 1;

  svg {
    width: 1em;
    height: 1em;
  }

  /* Тонкая линия в 9–10 px не видна — галочка толще. */
  &.verified svg {
    stroke-width: 3.5;
  }

  &.moderator {
    background: var(--ui-mark-moderator);
    color: var(--ui-mark-moderator-on);
  }

  &.shark {
    background: var(--ui-mark-shark);
    color: var(--ui-mark-shark-on);
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
