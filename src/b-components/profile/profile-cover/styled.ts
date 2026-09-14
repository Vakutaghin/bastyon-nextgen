import styled, { css } from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

const props = {
  hasImage: Boolean,
  isBlur: Boolean,
}

export const SC_ProfileCover = styled('div', props)`
  width: 100%;
  height: 265px;
  background-color: ${COLORS.ANT_BLUE_BG};
  position: relative;
  overflow: hidden;

  ${(props) =>
    !props.hasImage &&
    css`
      background: linear-gradient(135deg, ${COLORS.ANT_BLUE_BG} 0%, ${COLORS.ANT_BLUE_LIGHT} 100%);
    `}
`

// <img>, а не div с background-image: URL из блокчейна остаётся атрибутом и не
// попадает в CSS (V16). object-fit: cover — тот же результат, что background-size.
export const SC_CoverImage = styled('img', props)`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;

  ${(props) =>
    props.isBlur &&
    css`
      filter: blur(10px);
      transform: scale(1.1);
    `}
`
