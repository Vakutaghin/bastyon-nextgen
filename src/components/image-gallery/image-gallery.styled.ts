import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { TRANSITIONS } from '@/styles/design-tokens'

// Стили лайтбокса (.vel-*) живут глобально в src/style.css — vue-easy-lightbox
// телепортит .vel-modal в <body>, поэтому :deep отсюда не доходил (мёртвый код).
// До 2026-05 жили в image-gallery.styles.css через `<style scoped src>`. Тут
// остаётся только layout-обёртка. См. CODE_AUDIT.md §3.2.
export const SC_LightboxRoot = styled.div`
  display: contents;
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
