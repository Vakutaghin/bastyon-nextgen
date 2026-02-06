import styled from 'vue3-styled-components'

export const SC_VideosSection = styled.div`
  flex: 1 !important;
  min-height: 200px !important;
  max-height: 400px !important;
  overflow-y: auto !important;
  padding: 16px !important;
  background-color: #f5f5f5 !important;
  border-radius: 8px !important;
`

export const SC_SectionTitle = styled.h3`
  margin: 0 0 16px 0 !important;
  font-size: 18px !important;
  font-weight: 600 !important;
  color: #333 !important;
`

export const SC_VideosGrid = styled.div`
  display: grid !important;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)) !important;
  gap: 16px !important;
`

export const SC_VideoItem = styled.div`
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  padding: 16px !important;
  background-color: white !important;
  border-radius: 8px !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
  border: none !important;

  &:hover {
    box-shadow: 0 4px 12px rgba(24, 144, 255, 0.15) !important;
    transform: translateY(-2px) !important;

    /* Показываем действия при hover - используем класс */
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
  color: #333 !important;
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
  color: #666 !important;
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
  z-index: 10 !important;
  pointer-events: none !important;
  backdrop-filter: blur(4px) !important;
  background: rgba(0, 0, 0, 0.3) !important;
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
  background-color: rgba(255, 255, 255, 0.95) !important;
  color: #333 !important;
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
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;

  /* Убираем обводку при фокусе и активном состоянии */
  &:focus,
  &:active,
  &:focus-visible {
    border: none !important;
    outline: none !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
  }

  /* Принудительно задаем цвет для всех элементов внутри */
  &,
  & * {
    color: #333 !important;
  }

  /* Для span.anticon */
  span.anticon {
    color: #333 !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    opacity: 1 !important;
  }

  /* Для всех SVG элементов */
  svg,
  span.anticon svg {
    color: #333 !important;
    fill: #333 !important;
    stroke: #333 !important;
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
    fill: #333 !important;
    stroke: #333 !important;
    color: #333 !important;
    opacity: 1 !important;
  }

  /* Переопределяем currentColor */
  svg[fill="currentColor"],
  span.anticon svg[fill="currentColor"] {
    fill: #333 !important;
  }

  svg path[fill="currentColor"],
  span.anticon svg path[fill="currentColor"] {
    fill: #333 !important;
  }

  &:hover {
    background-color: rgba(255, 255, 255, 1) !important;
    transform: scale(1.05) translateY(-1px) !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
  }

  &:active {
    transform: scale(0.98) translateY(0) !important;
  }

  &[danger] {
    background-color: rgba(255, 77, 79, 0.95) !important;
    color: #ffffff !important;

    &,
    & *,
    & svg,
    & span.anticon svg,
    & svg path,
    & span.anticon svg path {
      color: #ffffff !important;
      fill: #ffffff !important;
      stroke: #ffffff !important;
    }

    &:hover {
      background-color: rgba(255, 77, 79, 1) !important;
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
