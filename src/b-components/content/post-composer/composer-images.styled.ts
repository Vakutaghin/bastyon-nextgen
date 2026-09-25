import styled from 'vue3-styled-components'

import { FONT_SIZE, SPACING } from '@/styles/design-tokens'
import { COLORS } from '@/styles/theme-colors'

export const SC_ImagesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: ${SPACING.SM};
`

export const SC_ImageThumb = styled.div`
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
  background: var(--color-bg-tertiary);

  & img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`

export const SC_ImageRemove = styled.button`
  position: absolute;
  top: 4px;
  right: 4px;
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
  font-size: ${FONT_SIZE.MD};
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: var(--color-overlay-70);
  }
`

export const SC_ImageRotate = styled.button`
  position: absolute;
  top: 4px;
  left: 4px;
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
  font-size: ${FONT_SIZE.SM};
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: var(--color-overlay-70);
  }
`

export const SC_ImageEdit = styled.button`
  position: absolute;
  bottom: 4px;
  left: 4px;
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
  font-size: ${FONT_SIZE.SM};
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: var(--color-overlay-70);
  }
`

const tileProps = { dragover: Boolean }

export const SC_AddTile = styled('label', tileProps)`
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1 / 1;
  border: 1px dashed ${(props) => (props.dragover ? COLORS.PRIMARY : COLORS.BORDER)};
  border-radius: var(--ui-radius-lg);
  color: var(--color-text-secondary);
  font-size: 28px;
  cursor: pointer;
  background: ${(props) => (props.dragover ? COLORS.PRIMARY_LIGHT : 'transparent')};
  transition:
    border-color var(--transition-quick),
    background var(--transition-quick);

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  & input {
    display: none;
  }
`
