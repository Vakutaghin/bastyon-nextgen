import styled from 'vue3-styled-components'

export const SC_VideosSection = styled.div`
  flex: 1;
  min-height: 200px;
  max-height: 400px;
  overflow-y: auto;
  padding: 16px;
  background-color: var(--color-bg-tertiary);
  border-radius: var(--ui-radius-lg);
`

export const SC_SectionTitle = styled.h3`
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_VideosGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 16px;
`

export const SC_VideoItem = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  background-color: var(--color-bg-primary);
  border-radius: var(--ui-radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
  border: none;

  &:hover {
    z-index: 100;
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);

    /* Показываем действия при hover */
    .video-actions {
      opacity: 1;
      pointer-events: auto;
    }

    /* Убираем обводку у всех вложенных элементов */
    * {
      border: none;
      outline: none;
    }
  }

  &:active {
    transform: translateY(0);
  }

  /* Убираем обводку у всех вложенных элементов */
  * {
    border: none;
    outline: none;
  }
`

export const SC_VideoIcon = styled.div`
  margin-bottom: 8px;
`

export const SC_VideoName = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: var(--ui-text-highlighted);
  text-align: center;
  word-break: break-word;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
`

export const SC_VideoResolution = styled.div`
  font-size: 10px;
  color: var(--color-text-secondary);
  text-align: center;
`

export const SC_VideoActions = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 6px;
  opacity: 0;
  transition: all var(--transition-normal);
  z-index: 50;
  pointer-events: none;
  backdrop-filter: blur(4px);
  background: var(--color-overlay-30);
  padding: 4px;
  border-radius: var(--ui-radius-md);
  border: none;
  outline: none;

  /* Убираем обводку у всех вложенных элементов */
  * {
    border: none;
    outline: none;
  }

  /* Убеждаемся, что кнопки всегда видны (когда родитель виден) */
  & button {
    opacity: 1;
    pointer-events: auto;
    border: none;
    outline: none;
  }
`

export const SC_ActionButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: var(--ui-radius-md);
  border: none;
  outline: none;
  background-color: var(--color-surface-frosted);
  color: var(--color-text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: all var(--transition-fast);
  padding: 0;
  line-height: 1;
  opacity: 1;
  pointer-events: auto;
  box-shadow: var(--shadow-md);

  /* Убираем обводку при фокусе и активном состоянии */
  &:focus,
  &:active,
  &:focus-visible {
    border: none;
    outline: none;
    box-shadow: var(--shadow-md);
  }

  /* Принудительно задаем цвет для всех элементов внутри */
  &,
  & * {
    color: var(--color-text-primary);
  }

  /* Для span.anticon */
  span.anticon {
    color: var(--color-text-primary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    opacity: 1;
  }

  /* Иконки Lucide — контурные: цвет обводки, без заливки (раньше здесь
     красились и fill, и stroke — под antd-иконки с заливкой). */
  svg,
  span.anticon svg {
    color: var(--color-text-primary);
    fill: none;
    stroke: currentcolor;
    width: 16px;
    height: 16px;
    opacity: 1;
  }

  &:hover {
    background-color: var(--color-bg-primary);
    transform: scale(1.05) translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  &:active {
    transform: scale(0.98) translateY(0);
  }

  &[danger] {
    background-color: var(--color-red-ant);
    color: var(--color-white);

    &,
    & *,
    & svg,
    & span.anticon svg,
    & svg path,
    & span.anticon svg path {
      color: var(--color-white);
      fill: none;
      stroke: var(--color-white);
    }

    &:hover {
      background-color: var(--color-red-ant);
      transform: scale(1.05) translateY(-1px);
    }
  }
`

export const SC_EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
`

export const SC_LoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
`
