import styled from 'vue3-styled-components'

export const SC_BlockImage = styled.figure`
  margin: 1em 0;
  text-align: center;
`

export const SC_BlockImageImg = styled.img`
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  display: block;
  margin: 0 auto;
`

export const SC_BlockImageCaption = styled.figcaption`
  margin-top: 0.5em;
  font-size: 0.9em;
  color: rgb(var(--color-txt-gray, 100, 100, 100));
  font-style: italic;
`
