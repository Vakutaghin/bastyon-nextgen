import styled from 'vue3-styled-components'
import { Z_INDEX } from '@/styles/design-tokens'

// Подсказка как была у antd в нашей теме (и как у Nuxt): светлая в светлой
// теме — фон страницы, кольцо-рамка и тень оверлеев, текст 12px, отступы
// 6 / 8, радиус 4, без стрелки. Слой постоянный — над окнами и меню.
//
// Части для styled родителя: .ui-tooltip; ширина — --ui-tooltip-max-width.
export const SC_Tooltip = styled.div`
  z-index: ${() => Z_INDEX.TOOLTIP};
  box-sizing: border-box;
  min-width: 24px;
  max-width: var(--ui-tooltip-max-width, 250px);
  min-height: 24px;
  padding: 6px 8px;
  overflow-wrap: break-word;
  border-radius: var(--ui-radius-sm);
  background: var(--ui-bg);
  box-shadow:
    0 0 0 1px var(--ui-border),
    var(--ui-shadow-lg);
  color: var(--ui-text-highlighted);
  font-size: 12px;
  line-height: 1.5714;
  text-align: start;
  -webkit-user-select: none;
  user-select: none;
`
