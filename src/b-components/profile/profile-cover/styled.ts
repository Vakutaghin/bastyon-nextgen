import styled from 'vue3-styled-components'

export const SC_ProfileCover = styled.div`
  width: 100%;
  height: 265px;
  background-color: rgb(var(--ui-primary-rgb) / 10%);
  position: relative;
  overflow: hidden;
`

// <img>, а не div с background-image: URL из блокчейна остаётся атрибутом и не
// попадает в CSS (V16). object-fit: cover — тот же результат, что background-size.
export const SC_CoverImage = styled.img`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
`
