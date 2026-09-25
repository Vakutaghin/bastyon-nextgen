import styled from 'vue3-styled-components'
import Button from '@/components/button/button.vue'

export const SC_PreviewBlock = styled.div`
  margin-bottom: 10px;
`

export const SC_ReadMoreButton = styled(Button)`
  margin-top: 10px;
  background-color: var(--color-bg-hover);
`

export const SC_PostContent = styled.div`
  margin-bottom: 15px;
  /* Как текст у Nuxt UI: 1.2 было тесно для длинных постов. */
  line-height: 1.5;
  color: var(--color-text-primary) !important;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;

  p {
    margin: 6px 0;
    color: var(--color-text-primary) !important;
    word-wrap: break-word;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  * {
    color: var(--color-text-primary) !important;
  }

  div {
    color: var(--color-text-primary) !important;
  }

  span {
    color: var(--color-text-primary) !important;
  }

  .bastyon-link {
    color: var(--ui-primary-text) !important;
    text-decoration: underline;
    cursor: pointer;
    word-break: break-all;
    overflow-wrap: break-word;
    word-wrap: break-word;
  }

  .bastyon-link:hover {
    color: var(--ui-primary) !important;
    text-decoration: underline;
  }

  .timecode-link {
    color: var(--ui-primary-text) !important;
    text-decoration: none;
    cursor: pointer;
    font-variant-numeric: tabular-nums;
    border-bottom: 1px dashed currentColor;
  }

  .timecode-link:hover {
    color: var(--ui-primary) !important;
    border-bottom-style: solid;
  }
`

export const SC_PostPreview = styled.div`
  position: relative;
  line-height: 1.5;
  overflow: hidden;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;

  p {
    margin: 0 0 7.5px;
    color: var(--color-text-primary) !important;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .bastyon-link {
    color: var(--ui-primary-text) !important;
    text-decoration: underline;
    cursor: pointer;
    word-break: break-all;
    overflow-wrap: break-word;
    word-wrap: break-word;
  }

  .bastyon-link:hover {
    color: var(--ui-primary) !important;
    text-decoration: underline;
  }
`
