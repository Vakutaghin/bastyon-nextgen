import styled from 'vue3-styled-components'

import { FONT_SIZE, SPACING } from '@/styles/design-tokens'
import { COLORS } from '@/styles/theme-colors'

/** Блок картинок: раскладка, «Добавить» и подсказка. Во время публикации — неактивен целиком. */
export const SC_ImagesBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${() => SPACING.SM};
  transition: opacity var(--transition-quick);

  &.disabled {
    opacity: 0.6;
  }

  &.disabled > * {
    pointer-events: none;
  }
`

/** Раскладка как в ленте: ширина 1, высота — по пропорциям картинок. */
export const SC_Collage = styled.div`
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: var(--ui-radius-lg);
  background: var(--color-bg-tertiary);
`

export const SC_CollageTile = styled.div`
  position: absolute;
  transition: opacity var(--transition-quick);

  &[draggable='true'] {
    cursor: grab;
  }

  &.dragging {
    opacity: 0.4;
  }

  &.target::after {
    content: '';
    position: absolute;
    inset: 1px;
    border: 2px solid var(--color-primary);
    border-radius: var(--ui-radius-md);
    pointer-events: none;
  }
`

export const SC_CollageCell = styled.div`
  position: absolute;
  overflow: hidden;

  & img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    user-select: none;
  }
`

export const SC_ImagesFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${() => SPACING.SM};
`

export const SC_ImagesHint = styled.span`
  flex: 1;
  min-width: 160px;
  color: var(--color-text-secondary);
  font-size: ${() => FONT_SIZE.SM};
`

const roundButton = `
  position: absolute;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--color-overlay-55);
  color: var(--color-white);
  line-height: 1;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--color-overlay-70);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`

export const SC_ImageRemove = styled.button`
  ${() => roundButton}
  top: 4px;
  right: 4px;
  font-size: ${() => FONT_SIZE.MD};
`

export const SC_ImageRotate = styled.button`
  ${() => roundButton}
  top: 4px;
  left: 4px;
  font-size: ${() => FONT_SIZE.SM};
`

export const SC_ImageEdit = styled.button`
  ${() => roundButton}
  bottom: 4px;
  left: 4px;
  font-size: ${() => FONT_SIZE.SM};
`

const tileProps = { dragover: Boolean }

/** «+ Добавить изображения» под раскладкой; сюда же можно бросить файлы. */
export const SC_AddTile = styled('label', tileProps)`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 1px dashed ${(props) => (props.dragover ? COLORS.PRIMARY : COLORS.BORDER)};
  border-radius: var(--ui-radius-full);
  color: var(--color-text-secondary);
  font-size: ${() => FONT_SIZE.SM};
  cursor: pointer;
  background: ${(props) => (props.dragover ? COLORS.PRIMARY_LIGHT : 'transparent')};
  transition:
    border-color var(--transition-quick),
    background var(--transition-quick);

  &:hover:not(.disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  &.disabled {
    cursor: not-allowed;
  }

  & input {
    display: none;
  }
`
