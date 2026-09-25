import styled from 'vue3-styled-components'
import { BREAKPOINTS, Z_INDEX, TRANSITIONS } from '@/styles/design-tokens'
import Button from '@/components/button/button.vue'

export const SC_NewPostsPill = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 auto 12px;
  padding: 6px 12px;
  border: none;
  border-radius: 999px;
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

export const SC_FeedErrorColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`

export const SC_RetryButton = styled(Button)`
  margin-top: 10px;
`

export const SC_Feed = styled.div`
  width: 100%;
`

export const SC_FeedHeader = styled.div`
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
  bottom: 24px;
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

export const SC_PhotoPreviewOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: var(--color-overlay-85);
  z-index: ${Z_INDEX.MODAL};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  gap: 16px;
`

export const SC_PhotoPreviewImage = styled.img`
  max-width: 100%;
  max-height: 70vh;
  border-radius: var(--ui-radius-lg);
`

export const SC_PhotoPreviewHint = styled.div`
  color: var(--color-white);
  font-size: 14px;
  opacity: 0.85;
`
