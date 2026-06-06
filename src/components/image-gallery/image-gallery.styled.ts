import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { TRANSITIONS } from '@/styles/design-tokens'

// Стили для vue-easy-lightbox через :deep — лендятся на глобальные `.vel-*` классы
// внутри SFC vue-easy-lightbox. До 2026-05 жили в image-gallery.styles.css и подключались
// через `<style scoped src>`, что нарушало конвенцию проекта (только styled-components).
// См. CODE_AUDIT.md §3.2.
export const SC_LightboxRoot = styled.div`
  display: contents;

  :deep(.vel-modal) {
    background-color: ${COLORS.OVERLAY_88};
    touch-action: pan-x pan-y pinch-zoom;
  }

  :deep(.vel-img) {
    max-width: 90vw;
    max-height: 90vh;
    object-fit: contain;
    touch-action: pan-x pan-y pinch-zoom;
  }

  :deep(.vel-close) {
    color: ${COLORS.WHITE_85};
    font-size: 32px;
    opacity: 0.8;
    transition: opacity ${TRANSITIONS.FAST};
  }

  :deep(.vel-close:hover) {
    opacity: 1;
  }

  :deep(.vel-btn) {
    color: ${COLORS.WHITE_85};
    opacity: 0.8;
    transition: opacity ${TRANSITIONS.FAST};
  }

  :deep(.vel-btn:hover) {
    opacity: 1;
  }
`

// Кнопка «скачать» поверх лайтбокса (его z-index = 9998). Фиксируем выше.
export const SC_DownloadBtn = styled.button`
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 9999;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: ${COLORS.OVERLAY_40};
  color: ${COLORS.WHITE_85};
  font-size: 20px;
  cursor: pointer;
  opacity: 0.85;
  transition:
    opacity ${TRANSITIONS.FAST},
    background ${TRANSITIONS.FAST};

  &:hover:not(:disabled) {
    opacity: 1;
    background: ${COLORS.OVERLAY_65};
    color: ${COLORS.WHITE};
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`
