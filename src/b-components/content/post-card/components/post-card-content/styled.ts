import styled from 'vue3-styled-components'
import Button from '@/components/button/button.vue'

/**
 * Ссылки в тексте поста — цветом и с подчёркиванием: правило «*» ниже красит
 * всё в цвет текста, и без этого ссылку было не отличить. У @меншена цвет без
 * черты (она по наведению), у тайм-кода — своя пунктирная. Длинный адрес
 * bastyon:// переносится где угодно.
 */
const LINKS = `
  a[href] {
    color: var(--ui-primary-text) !important;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
  }

  a[href] * {
    color: inherit !important;
  }

  a[href]:hover {
    color: var(--ui-primary) !important;
  }

  a.mention-link,
  a.timecode-link {
    text-decoration: none;
  }

  a.mention-link:hover {
    text-decoration: underline;
  }

  .bastyon-link {
    word-break: break-all;
  }
`

export const SC_PreviewBlock = styled.div`
  margin-bottom: 10px;
`

export const SC_ReadMoreButton = styled(Button)`
  margin-top: 10px;
  background-color: var(--color-bg-hover);
`

export const SC_PostContent = styled.div`
  margin-bottom: 15px;
  /* Текст поста — 16px, как prose у Nuxt и как было до редизайна: раньше
     размер наследовался от темы antd (fontSize 16), с интерфейсными 14px
     тема его уменьшила. Интерлиньяж 1.5: 1.2 было тесно для длинных постов. */
  font-size: 16px;
  line-height: calc(1.5 * var(--leading-scale));
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

  ${() => LINKS}

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
  font-size: 16px;
  line-height: calc(1.5 * var(--leading-scale));
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

  ${() => LINKS}
`
