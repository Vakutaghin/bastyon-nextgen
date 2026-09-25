import styled from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'

/** Значок подсказки — иконка «круг с вопросом», как подсказки у Nuxt UI:
 * приглушённая, на наведении — цвет текста. */
export const SC_InfoTooltipIcon = styled.span`
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
  font-size: 14px;
  color: var(--ui-text-dimmed);
  cursor: help;
  user-select: none;
  vertical-align: middle;
  transition: color ${TRANSITIONS.QUICK};

  &:hover {
    color: var(--ui-text);
  }
`
