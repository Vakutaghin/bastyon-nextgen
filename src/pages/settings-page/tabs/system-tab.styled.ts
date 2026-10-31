import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

// Строка настройки на телефоне: подпись во всю ширину; переключатель и одна
// кнопка — справа от неё, выбор варианта и группы кнопок — под ней во всю
// ширину. Так у всех вкладок одна сетка и ничего не вылезает за экран.

export const SC_SystemSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 28px;
`

export const SC_SystemRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--ui-border);

  &:last-child {
    border-bottom: 0;
  }

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    flex-wrap: wrap;
    gap: 10px 16px;
  }
`

export const SC_SystemLabel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  /* Занимает остаток строки, но не выталкивает переключатель вниз. */
  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    flex: 1 1 0;
  }
`

/** Подпись и описание строки — как у поля формы Nuxt UI. */
export const SC_SystemTitle = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text-highlighted);
`

export const SC_SystemHint = styled.span`
  font-size: 14px;
  color: var(--ui-text-muted);
`

/** Выбор варианта — вкладки-pill Nuxt UI, как язык и тема. */
export const SC_ScaleRow = styled.div`
  display: inline-flex;
  flex-shrink: 0;
  gap: 2px;
  padding: 4px;
  background: var(--ui-bg-elevated);
  border-radius: var(--ui-radius-lg);

  /* Под подписью во всю ширину, варианты поровну. */
  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    display: flex;
    flex: 1 1 100%;
    flex-wrap: wrap;
  }
`

const scaleProps = { active: Boolean }

export const SC_ScaleButton = styled('button', scaleProps)`
  padding: 4px 12px;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  cursor: pointer;
  border: none;
  border-radius: var(--ui-radius-md);
  background: ${(p) => (p.active ? 'var(--ui-primary)' : 'transparent')};
  color: ${(p) => (p.active ? 'var(--ui-text-inverted)' : 'var(--ui-text-muted)')};
  box-shadow: ${(p) => (p.active ? 'var(--ui-shadow-xs)' : 'none')};
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);

  &:hover {
    background: ${(p) => (p.active ? 'var(--ui-primary)' : 'transparent')};
    color: ${(p) => (p.active ? 'var(--ui-text-inverted)' : 'var(--ui-text-highlighted)')};
  }

  /* Палец: группа высотой 44 px; длинная подпись переносится по словам. */
  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    flex: 1 1 0;
    min-height: 36px;
    padding: 6px 4px;
    text-align: center;
  }
`

export const SC_DangerButton = styled.button`
  flex-shrink: 0;
  /* Outline-кнопка цветом ошибки, как у Nuxt UI. */
  background: transparent;
  color: var(--ui-error);
  border: 0;
  box-shadow: inset 0 0 0 1px rgb(var(--ui-error-rgb) / 50%);
  border-radius: var(--ui-radius-md);
  padding: 6px 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition-fast);

  &:hover:not(:disabled) {
    background: rgb(var(--ui-error-rgb) / 10%);
    color: var(--ui-error);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.75;
  }

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    min-height: 36px;
    padding: 6px 12px;
  }
`

/** Строка кэша: подпись, а под ней на узком окне — предел и кнопка. */
export const SC_CacheRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--ui-border);

  &:last-child {
    border-bottom: 0;
  }
`

export const SC_CacheControls = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-left: auto;

  /* Телефон: выбор — строкой во всю ширину, под ним переключатель и кнопка по краям. */
  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    flex: 1 1 100%;
    justify-content: space-between;
    gap: 10px 8px;
    margin-left: 0;
  }
`

/**
 * Качество скачанных роликов: семь вариантов в строку телефона не входят —
 * на нём две ровные строки по четыре ячейки, «Спрашивать» — в две.
 */
export const SC_QualityRow = styled(SC_ScaleRow)`
  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    display: grid;
    grid-template-columns: repeat(4, 1fr);

    & > :first-child {
      grid-column: span 2;
    }
  }
`

/** Сколько занято сейчас — под описанием. */
export const SC_CacheUsage = styled.span`
  font-size: 14px;
  color: var(--ui-text-highlighted);
  font-variant-numeric: tabular-nums;
`

/** Переключатель с подписью справа — внутри строки с кнопками. */
export const SC_SwitchLine = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--ui-text);
  cursor: pointer;
`
