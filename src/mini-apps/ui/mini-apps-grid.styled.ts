import styled from 'vue3-styled-components'
import { BREAKPOINTS, TRANSITIONS } from '@/styles/design-tokens'
import { SC_SectionTitle as SC_SharedSectionTitle } from '@/styles/shared'

export const SC_Search = styled.div`
  margin: 8px 0 16px;
`

export const SC_SideloadBar = styled.div`
  display: flex;
  justify-content: flex-end;
  margin: 0 0 16px;
`

export const SC_SideloadBtn = styled.button`
  padding: 6px 10px;
  border: 1px dashed var(--ui-border-accented);
  border-radius: var(--ui-radius-md);
  background: none;
  color: var(--ui-text-muted);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: color ${TRANSITIONS.FAST};

  &:hover {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
`

export const SC_Categories = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 16px;
`

/** Фильтр — маленькая кнопка Nuxt UI: нейтральная outline, выбранный — solid. */
export const SC_CategoryChip = styled.button`
  padding: 4px 10px;
  border-radius: var(--ui-radius-md);
  border: 0;
  box-shadow: inset 0 0 0 1px var(--ui-border-accented);
  background: var(--ui-bg);
  color: var(--ui-text);
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  cursor: pointer;
  transition:
    background ${TRANSITIONS.FAST},
    color ${TRANSITIONS.FAST},
    border-color ${TRANSITIONS.FAST};

  &:hover {
    background: var(--ui-bg-elevated);
    color: var(--ui-text);
  }

  &.active {
    background: var(--ui-primary);
    box-shadow: none;
    color: var(--ui-text-inverted);
  }
`

export const SC_Section = styled.section`
  margin: 0 0 24px;
`

// Общий заголовок секции (audit §3.2) + нижний отступ под grid.
export const SC_SectionTitle = styled(SC_SharedSectionTitle)`
  margin: 0 0 12px;
`

export const SC_Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 12px;
  }
`

export const SC_Card = styled.button`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  padding: 20px 12px 16px;
  border: 1px solid var(--color-overlay-8);
  border-radius: var(--ui-radius-lg);
  background: var(--color-bg-primary);
  cursor: pointer;
  transition:
    transform ${TRANSITIONS.QUICK},
    box-shadow ${TRANSITIONS.QUICK},
    border-color ${TRANSITIONS.QUICK};
  text-align: center;
  font: inherit;
  color: var(--color-gray-212);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 14px var(--color-overlay-6);
    border-color: var(--color-overlay-12);
  }

  &:active {
    transform: translateY(0);
  }
`

export const SC_FavoriteBtn = styled.button`
  position: absolute;
  top: 6px;
  right: 6px;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: 14px;
  transition:
    color ${TRANSITIONS.QUICK},
    background-color ${TRANSITIONS.QUICK};

  &:hover {
    background: var(--color-overlay-5);
    color: var(--color-warning-yellow);
  }

  &.active {
    color: var(--color-warning-yellow);
  }
`

/** Кнопка удаления сайдлоад-приложения (S51). Рядом со звёздочкой, слева от неё. */
export const SC_DeleteBtn = styled.button`
  position: absolute;
  top: 6px;
  left: 6px;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: 14px;
  transition:
    color ${TRANSITIONS.QUICK},
    background-color ${TRANSITIONS.QUICK};

  &:hover {
    background: var(--color-overlay-5);
    color: var(--color-danger);
  }
`

export const SC_IconWrap = styled.div`
  width: 56px;
  height: 56px;
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-overlay-4);
  flex: 0 0 auto;
`

export const SC_Icon = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`

export const SC_IconFallback = styled.div`
  font-size: 22px;
  font-weight: 500;
  color: var(--color-text-secondary);
`

export const SC_Name = styled.div`
  font-size: 14px;
  font-weight: 500;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
`

export const SC_LoadMore = styled.div`
  display: flex;
  justify-content: center;
  margin: 20px 0;
`

export const SC_LoadMoreBtn = styled.button`
  padding: 8px 20px;
  border: 1px solid var(--color-overlay-12);
  background: var(--color-bg-primary);
  border-radius: var(--ui-radius-lg);
  font-size: 14px;
  color: var(--color-gray-212);
  cursor: pointer;
  transition: background-color ${TRANSITIONS.QUICK};

  &:hover {
    background: var(--color-overlay-4);
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`

export const SC_Empty = styled.div`
  padding: 40px 16px;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 14px;
`

export const SC_Error = styled.div`
  padding: 16px;
  border-radius: var(--ui-radius-lg);
  background: var(--color-danger-bg-soft);
  color: var(--color-danger-deep);
  font-size: 14px;
  margin: 12px 0;
`
