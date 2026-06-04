import styled from 'vue3-styled-components'

import { BORDER_RADIUS, FONT_SIZE, SPACING } from '@/styles/design-tokens'
import { COLORS } from '@/styles/theme-colors'

export const SC_ImagesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: ${SPACING.SM};
`

export const SC_ImageThumb = styled.div`
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: ${BORDER_RADIUS.MD};
  overflow: hidden;
  background: ${COLORS.BG_TERTIARY};

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
  background: ${COLORS.OVERLAY_55};
  color: ${COLORS.WHITE};
  font-size: ${FONT_SIZE.MD};
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: ${COLORS.OVERLAY_70};
  }
`

const tileProps = { dragover: Boolean }

export const SC_AddTile = styled('label', tileProps)`
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1 / 1;
  border: 1px dashed ${(props) => (props.dragover ? COLORS.PRIMARY : COLORS.BORDER)};
  border-radius: ${BORDER_RADIUS.MD};
  color: ${COLORS.TEXT_SECONDARY};
  font-size: 28px;
  cursor: pointer;
  background: ${(props) => (props.dragover ? COLORS.PRIMARY_LIGHT : 'transparent')};
  transition:
    border-color 0.15s ease,
    background 0.15s ease;

  &:hover {
    border-color: ${COLORS.PRIMARY};
    color: ${COLORS.PRIMARY};
  }

  & input {
    display: none;
  }
`
