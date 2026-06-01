import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { Z_INDEX } from '@/styles/design-tokens'
import Button from '@/components/button/button.vue'

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
  height: 38px;
  display: inline-flex;
  align-items: center;

  button {
    height: 100% !important;
    min-height: 100% !important;
    padding: 0 12px;
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
  font-size: 22px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
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

  :deep(.ant-spin) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
  }

  :deep(.ant-spin-spinning) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
  }

  :deep(.anticon) {
    font-size: 120px !important;
    color: ${COLORS.PRIMARY} !important;
  }

  :deep(.ant-spin-text) {
    font-size: 24px !important;
    color: ${COLORS.TEXT_PRIMARY} !important;
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
  color: ${COLORS.TEXT_SECONDARY};

  p {
    margin: 0;
    font-size: 15px;
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
  color: ${COLORS.TEXT_SECONDARY};
  font-size: 16px;

  p {
    margin: 0;
  }
`

export const SC_FeedRefreshWrap = styled.div`
  display: inline-flex;
  align-items: center;
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
  padding: 10px 16px;
  font-size: 14px;
  color: ${COLORS.TEXT_PRIMARY};
  background: ${COLORS.SURFACE_FROSTED};
  backdrop-filter: blur(8px);
  border: 1px solid ${COLORS.OVERLAY_8};
  border-radius: 8px;
  cursor: pointer;
  box-shadow: ${COLORS.SHADOW_MD};
  transition:
    background 0.2s,
    transform 0.2s,
    box-shadow 0.2s;

  &:hover {
    background: ${COLORS.BG_PRIMARY};
    transform: translate(-50%, -1px);
    box-shadow: ${COLORS.SHADOW_MD};
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
  background: ${COLORS.OVERLAY_85};
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
  border-radius: 8px;
`

export const SC_PhotoPreviewHint = styled.div`
  color: ${COLORS.WHITE};
  font-size: 14px;
  opacity: 0.85;
`
