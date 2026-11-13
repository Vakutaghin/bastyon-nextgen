import styled from 'vue3-styled-components'
import { noSelect } from '@/styles/chrome-styles'

// Аватар в оформлении Nuxt UI (UAvatar): круг без рамки, инициалы 500-м
// начертанием. Значок «ждёт регистрации» — точка с кольцом цвета фона, как
// UChip; проверенный, модератор и «акула» — components/user-mark.
export const SC_Avatar = styled.div<{
  shape?: 'circle' | 'square'
}>`
  ${noSelect}
  position: relative;
  border-radius: ${(p) => (p.shape === 'square' ? 'var(--ui-radius-sm)' : '50%')};
  overflow: visible;

  /* Круг с инициалами (нет фото или оно не пришло) — как был antd Avatar:
     текст 18px, строка по центру; ужимает её fit-initials.ts. Цвета задаёт
     оттенок пользователя инлайном, здесь — запасные. */
  .ui-avatar {
    position: relative;
    display: inline-block;
    overflow: hidden;
    border-radius: ${(p) => (p.shape === 'square' ? 'var(--ui-radius-sm)' : '50%')};
    background: var(--ui-text-dimmed);
    color: var(--color-white);
    font-size: 18px;
    font-weight: 500;
    white-space: nowrap;
    text-align: center;
    vertical-align: middle;
  }

  .ui-avatar__string {
    position: absolute;
    left: 50%;
    transform-origin: 0 center;
  }

  .pending-badge {
    position: absolute;
    bottom: -2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    box-shadow: 0 0 0 2px var(--ui-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    left: -2px;
    background: var(--ui-warning);
  }
`
