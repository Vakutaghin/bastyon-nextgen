import styled from 'vue3-styled-components'

// Стили лайтбокса (.vel-*) живут глобально в src/style.css — vue-easy-lightbox
// телепортит .vel-modal в <body>, поэтому :deep отсюда не доходил (мёртвый код).
// До 2026-05 жили в image-gallery.styles.css через `<style scoped src>`. Тут
// остаётся только layout-обёртка. См. CODE_AUDIT.md §3.2.
export const SC_LightboxRoot = styled.div`
  display: contents;
`
