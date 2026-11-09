import styled from 'vue3-styled-components'
import { BREAKPOINTS, TRANSITIONS, Z_INDEX } from '@/styles/design-tokens'
import Button from '@/components/button/button.vue'
import { noSelect } from '@/styles/chrome-styles'

export const SC_NewPostsPill = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 auto 12px;
  padding: 6px 12px;
  border: none;
  border-radius: var(--ui-radius-full);
  background: var(--ui-primary);
  color: var(--ui-text-inverted);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: var(--ui-shadow-lg);
  transition: background ${TRANSITIONS.FAST};

  /* color/background заданы и в :hover, чтобы перебить глобальное правило
     button:hover в style.css (оно делает фон прозрачным, а текст акцентным). */
  &:hover {
    background: rgb(var(--ui-primary-rgb) / 75%);
    color: var(--ui-text-inverted);
  }
`

/** Плашка после постов подписок: «Продолжить в ленте подписок». */
export const SC_SubscriptionsDivider = styled.div`
  ${noSelect}
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  margin-bottom: 15px;
  padding: 14px 16px;
  border: 1px dashed var(--ui-border-accented);
  border-radius: var(--ui-radius-lg);
  color: var(--ui-text-muted);
  font-size: 14px;
  line-height: calc(1.4 * var(--leading-scale));

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    margin-bottom: 10px;
  }
`

/** Строка над лентой: почему лента не обычная (редкий язык — лучшее за месяц). */
export const SC_FeedNote = styled.p`
  margin: 0 0 15px;
  padding: 10px 14px;
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg-elevated);
  color: var(--ui-text-muted);
  font-size: 14px;
  line-height: calc(1.4 * var(--leading-scale));

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    margin-bottom: 10px;
  }
`

export const SC_FeedErrorColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`

export const SC_RetryButton = styled(Button)`
  margin-top: 10px;
`

export const SC_Feed = styled.div`
  position: relative;
  width: 100%;
`

/**
 * Кружок «протяни, чтобы обновить»: выезжает сверху ленты за пальцем
 * (--pull-offset), проявляется (--pull-opacity), стрелка поворачивается
 * (--pull-turn); дотянули до порога —
 * цвета темы, отпустили — крутится, пока идёт обновление.
 */
export const SC_PullIndicator = styled.div`
  position: absolute;
  top: 0;
  left: 50%;
  z-index: ${() => Z_INDEX.LOCAL_DROPDOWN};
  width: 40px;
  height: 40px;
  margin-left: -20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ui-bg-elevated);
  color: var(--ui-text-muted);
  box-shadow: var(--ui-shadow-lg);
  font-size: 18px;
  opacity: var(--pull-opacity, 1);
  transform: translateY(calc(var(--pull-offset, 0px) - 44px));
  pointer-events: none;

  svg {
    transform: rotate(var(--pull-turn, 0deg));
  }

  &.armed,
  &.refreshing {
    color: var(--ui-primary);
  }

  &.refreshing {
    transition: transform ${() => TRANSITIONS.FAST};
  }

  &.refreshing svg {
    transform: none;
  }
`

export const SC_FeedHeader = styled.div`
  ${noSelect}
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 15px;
`

export const SC_FeedHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

export const SC_SidebarToggleWrap = styled.div`
  height: 32px;
  display: inline-flex;
  align-items: center;

  button {
    height: 100% !important;
    min-height: 100% !important;
    padding: 0 8px;
  }

  .anticon {
    font-size: 16px;
  }
`

export const SC_FeedHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

export const SC_FeedTitle = styled.h2`
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
  color: var(--ui-text-highlighted);
`

export const SC_FeedContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`

export const SC_FeedLoading = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 500px;
  padding: 100px 20px;
  width: 100%;

  .ant-spin {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
  }

  .ant-spin-spinning {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
  }

  .anticon {
    font-size: 120px !important;
    color: var(--color-primary) !important;
  }

  .ant-spin-text {
    font-size: 24px !important;
    color: var(--color-text-primary) !important;
    font-weight: 500;
    margin-top: 0;
    letter-spacing: 1px;
  }
`

export const SC_FeedError = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 45px 22px;
  text-align: center;
  color: var(--color-text-secondary);

  p {
    margin: 0;
    font-size: 14px;
  }
`

export const SC_FeedLoadingMore = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px 20px;
  width: 100%;
`

export const SC_FeedEnd = styled.div`
  text-align: center;
  padding: 30px 20px;
  color: var(--color-text-secondary);
  font-size: 16px;

  p {
    margin: 0;
  }
`

/** Порог «Репутации авторов» долго скрывал всё: что случилось и «Искать дальше». */
export const SC_FeedHiddenPause = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 30px 20px;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 14px;

  p {
    margin: 0;
  }
`

export const SC_FeedRefreshWrap = styled.div`
  display: inline-flex;
  align-items: center;

  /* На телефоне — только иконка, иначе «Создать пост» упирался в край экрана
     (подсказка остаётся в title кнопки). */
  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    .feed-refresh-label {
      display: none;
    }
  }
`

export const SC_ScrollToTop = styled.button`
  position: fixed;
  /* Над нижней панелью телефона: раньше она закрывала кнопку целиком. */
  bottom: calc(var(--bottom-nav-height-total) + 24px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text);
  background: rgb(var(--ui-bg-rgb) / 75%);
  backdrop-filter: blur(8px);
  border: 0;
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  box-shadow:
    0 0 0 1px var(--ui-border-accented),
    var(--ui-shadow-lg);
  transition:
    background var(--transition-fast),
    transform var(--transition-fast),
    box-shadow var(--transition-fast);

  &:hover {
    background: var(--ui-bg-elevated);
    color: var(--ui-text);
    transform: translate(-50%, -1px);
  }

  &:active {
    transform: translate(-50%, 0);
  }

  .anticon {
    font-size: 14px;
  }
`
