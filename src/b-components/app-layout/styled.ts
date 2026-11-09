import styled from 'vue3-styled-components'
import { Z_INDEX } from '@/styles/design-tokens'

export const SC_Application = styled.div`
  width: 100%;
  min-height: 100vh;
  position: relative;
`

/**
 * «Перейти к содержимому»: не видна, пока на ней нет фокуса с клавиатуры, —
 * первая же клавиша Tab показывает её в левом верхнем углу.
 */
export const SC_SkipLink = styled.a`
  position: fixed;
  top: calc(var(--safe-top) + 8px);
  left: calc(var(--safe-left) + 8px);
  z-index: ${() => Z_INDEX.TOOLTIP};
  padding: 8px 16px;
  border-radius: var(--ui-radius-md);
  background: var(--ui-primary);
  color: var(--ui-text-inverted);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transform: translateY(calc(-100% - var(--safe-top) - 16px));

  &:focus,
  &:focus-visible {
    transform: none;
    color: var(--ui-text-inverted);
  }
`

export const SC_Camera = styled.div`
  display: none;
`

export const SC_Appcnt = styled.div`
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding-bottom: var(--safe-bottom);
  /* Слева — колонка разделов телефона боком и вырез экрана, справа — вырез:
     в горизонтальном положении он сбоку. Стоя и на компьютере оба нуля. */
  padding-left: var(--shell-inset-left);
  padding-right: var(--safe-right);

  /* Когда видна нижняя навигация (моб/планшет) — резервируем под неё место,
     чтобы фиксированный бар (высота 50px + safe-area) не перекрывал контент. */
  &.has-bottom-nav {
    /* Та же переменная, что задаёт высоту самого бара, — чтобы отступ контента
       и бар не разъезжались. */
    padding-bottom: var(--bottom-nav-height-total);
  }

  /* Мини-плеер: на компьютере карточка внизу слева, на телефоне — полоса над
     нижней панелью. Последние строки страницы не должны оставаться под ним. */
  .has-mini-player & {
    padding-bottom: calc(var(--safe-bottom) + 88px);
  }

  .has-mini-player &.has-bottom-nav {
    padding-bottom: calc(var(--bottom-nav-height-total) + 62px);
  }
`
