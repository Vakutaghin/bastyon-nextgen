import styled from 'vue3-styled-components'

/**
 * Утилитарные layout-обёртки для тела модалок — заменяют распространённые
 * inline `style="..."` биндинги в confirm-*-modal.vue. См. CODE_AUDIT.md §3.1.
 */
/** Кнопочный ряд в футере модалки: справа, маленький gap. */
export const SC_ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

/** Строка с иконкой и текстом в шапке/блоке модалки. */
export const SC_ModalIconRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

/** Контейнер тела confirm-модалки с вертикальным паддингом. */
export const SC_ModalBody = styled.div`
  padding: 16px 0;
`

// SC_Modal оборачивает antd <Modal>, но antd телепортит содержимое модалки в
// <body>, поэтому стили .ant-modal-* отсюда через :deep() до него НЕ доходят
// (vue3-styled-components не пробрасывает :deep сквозь телепорт — см. коммент у
// .ant-card в src/style.css). Поэтому тема/оформление .ant-modal-* живут
// глобально в src/style.css (блок «Ant Design Modal»), а маска модалки задаётся
// инлайном через maskStyle в components/modal/modal.ts. Сама обёртка лейаут не
// формирует — content уезжает в телепорт.
export const SC_Modal = styled.div`
  display: contents;
`
