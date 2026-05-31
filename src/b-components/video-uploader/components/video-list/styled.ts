import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_VideosSection = styled.div`
  flex: 1 !important;
  min-height: 200px !important;
  max-height: 400px !important;
  overflow-y: auto !important;
  padding: 16px !important;
  background-color: ${COLORS.BG_TERTIARY} !important;
  border-radius: 8px !important;
`

export const SC_SectionTitle = styled.h3`
  margin: 0 0 16px !important;
  font-size: 18px !important;
  font-weight: 600 !important;
  color: ${COLORS.TEXT_PRIMARY} !important;
`

export const SC_VideosGrid = styled.div`
  display: grid !important;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)) !important;
  gap: 16px !important;
`

export const SC_VideoItem = styled.div`
  position: relative !important;
  z-index: 1 !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  padding: 16px !important;
  background-color: ${COLORS.BG_PRIMARY} !important;
  border-radius: 8px !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
  border: none !important;

  &:hover {
    z-index: 100 !important;
    box-shadow: ${COLORS.SHADOW_MD} !important;
    transform: translateY(-2px) !important;

    /* Показываем действия при hover */
    .video-actions {
      opacity: 1 !important;
      pointer-events: auto !important;
    }

    /* Убираем обводку у всех вложенных элементов */
    * {
      border: none !important;
      outline: none !important;
    }
  }

  &:active {
    transform: translateY(0) !important;
  }

  /* Убираем обводку у всех вложенных элементов */
  * {
    border: none !important;
    outline: none !important;
  }
`

export const SC_VideoIcon = styled.div`
  margin-bottom: 8px !important;
`

export const SC_VideoName = styled.div`
  font-size: 12px !important;
  font-weight: 500 !important;
  color: ${COLORS.TEXT_PRIMARY} !important;
  text-align: center !important;
  word-break: break-word !important;
  max-width: 100% !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
  margin-bottom: 4px !important;
`

export const SC_VideoResolution = styled.div`
  font-size: 10px !important;
  color: ${COLORS.TEXT_SECONDARY} !important;
  text-align: center !important;
`

export const SC_VideoActions = styled.div`
  position: absolute !important;
  top: 8px !important;
  right: 8px !important;
  display: flex !important;
  gap: 6px !important;
  opacity: 0 !important;
  transition: all 0.3s ease !important;
  z-index: 50 !important;
  pointer-events: none !important;
  backdrop-filter: blur(4px) !important;
  background: ${COLORS.OVERLAY_30} !important;
  padding: 4px !important;
  border-radius: 6px !important;
  border: none !important;
  outline: none !important;

  /* Убираем обводку у всех вложенных элементов */
  * {
    border: none !important;
    outline: none !important;
  }

  /* Убеждаемся, что кнопки всегда видны (когда родитель виден) */
  & button {
    opacity: 1 !important;
    pointer-events: auto !important;
    border: none !important;
    outline: none !important;
  }
`

export const SC_ActionButton = styled.button`
  width: 32px !important;
  height: 32px !important;
  border-radius: 6px !important;
  border: none !important;
  outline: none !important;
  background-color: ${COLORS.SURFACE_FROSTED} !important;
  color: ${COLORS.TEXT_PRIMARY} !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 16px !important;
  transition: all 0.2s ease !important;
  padding: 0 !important;
  line-height: 1 !important;
  opacity: 1 !important;
  pointer-events: auto !important;
  box-shadow: ${COLORS.SHADOW_MD} !important;

  /* Убираем обводку при фокусе и активном состоянии */
  &:focus,
  &:active,
  &:focus-visible {
    border: none !important;
    outline: none !important;
    box-shadow: ${COLORS.SHADOW_MD} !important;
  }

  /* Принудительно задаем цвет для всех элементов внутри */
  &,
  & * {
    color: ${COLORS.TEXT_PRIMARY} !important;
  }

  /* Для span.anticon */
  span.anticon {
    color: ${COLORS.TEXT_PRIMARY} !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    opacity: 1 !important;
  }

  /* Для всех SVG элементов */
  svg,
  span.anticon svg {
    color: ${COLORS.TEXT_PRIMARY} !important;
    fill: ${COLORS.TEXT_PRIMARY} !important;
    stroke: ${COLORS.TEXT_PRIMARY} !important;
    width: 16px !important;
    height: 16px !important;
    opacity: 1 !important;
  }

  /* Для всех путей и элементов внутри SVG */
  svg *,
  span.anticon svg *,
  svg path,
  svg circle,
  svg rect,
  svg line,
  svg polyline,
  svg polygon,
  svg g,
  span.anticon svg path,
  span.anticon svg circle,
  span.anticon svg rect,
  span.anticon svg line,
  span.anticon svg polyline,
  span.anticon svg polygon,
  span.anticon svg g {
    fill: ${COLORS.TEXT_PRIMARY} !important;
    stroke: ${COLORS.TEXT_PRIMARY} !important;
    color: ${COLORS.TEXT_PRIMARY} !important;
    opacity: 1 !important;
  }

  /* Переопределяем currentColor */
  svg[fill='currentColor'],
  span.anticon svg[fill='currentColor'] {
    fill: ${COLORS.TEXT_PRIMARY} !important;
  }

  svg path[fill='currentColor'],
  span.anticon svg path[fill='currentColor'] {
    fill: ${COLORS.TEXT_PRIMARY} !important;
  }

  &:hover {
    background-color: ${COLORS.BG_PRIMARY} !important;
    transform: scale(1.05) translateY(-1px) !important;
    box-shadow: ${COLORS.SHADOW_MD} !important;
  }

  &:active {
    transform: scale(0.98) translateY(0) !important;
  }

  &[danger] {
    background-color: ${COLORS.RED_ANT} !important;
    color: ${COLORS.WHITE} !important;

    &,
    & *,
    & svg,
    & span.anticon svg,
    & svg path,
    & span.anticon svg path {
      color: ${COLORS.WHITE} !important;
      fill: ${COLORS.WHITE} !important;
      stroke: ${COLORS.WHITE} !important;
    }

    &:hover {
      background-color: ${COLORS.RED_ANT} !important;
      transform: scale(1.05) translateY(-1px) !important;
    }
  }
`

export const SC_EmptyState = styled.div`
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-height: 200px !important;
`

export const SC_LoadingState = styled.div`
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-height: 200px !important;
`
