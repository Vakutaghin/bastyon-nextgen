import styled, { css } from 'vue3-styled-components'

const props = {
  hasImage: Boolean,
  image: String,
  isBlur: Boolean
}

export const SC_ProfileCover = styled('div', props)`
  width: 100%;
  height: 265px;
  background-color: #e6f7ff;
  position: relative;
  overflow: hidden;

  ${props => !props.hasImage && css`
    background-color: #1890ff;
    background: linear-gradient(135deg, #e6f7ff 0%, #91d5ff 100%);
  `}
`

export const SC_CoverImage = styled('div', props)`
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-image: url(${props => props.image});
  
  ${props => props.isBlur && css`
    filter: blur(10px);
    transform: scale(1.1);
  `}
`
