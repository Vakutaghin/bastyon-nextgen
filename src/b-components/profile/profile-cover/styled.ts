import styled, { css } from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

const props = {
  hasImage: Boolean,
  image: String,
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

export const SC_CoverImage = styled('div', props)`
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-image: url(${(props) => props.image});

  ${(props) =>
    props.isBlur &&
    css`
      filter: blur(10px);
      transform: scale(1.1);
    `}
`
