import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_InputSearch = styled.div`
  width: 45%;
  flex-shrink: 0;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    width: 100%;
    flex-shrink: 1;
  }

  :deep(.ant-input-search .ant-input) {
    background: ${COLORS.BG_PRIMARY};
    color: ${COLORS.TEXT_PRIMARY};
    border-color: ${COLORS.BORDER};
    border-radius: 24px;
    padding-left: 15px;
    padding-right: 37px;
  }

  :deep(.ant-input-search .ant-input:hover:not(:disabled)) {
    border-color: ${COLORS.TEXT_MUTED};
  }

  :deep(.ant-input-search .ant-input:focus),
  :deep(.ant-input-search .ant-input-focused) {
    border-color: ${COLORS.PRIMARY};
    box-shadow: 0 0 0 2px ${COLORS.PRIMARY_LIGHT_20};
  }

  :deep(.ant-input-search .ant-input::placeholder) {
    color: ${COLORS.TEXT_SECONDARY};
  }

  :deep(.ant-input-search-icon) {
    color: ${COLORS.TEXT_SECONDARY};
    right: 15px;
  }

  :deep(.ant-input-clear-icon) {
    color: ${COLORS.TEXT_SECONDARY};
    right: 37px;
  }

  :deep(.ant-input-clear-icon:hover) {
    color: ${COLORS.DANGER};
  }
`
