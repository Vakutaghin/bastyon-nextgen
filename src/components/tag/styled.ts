import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_Tag = styled.div`
  .ant-tag {
    background: ${COLORS.PRIMARY_LIGHT};
    color: ${COLORS.PRIMARY};
    border-color: ${COLORS.PRIMARY_LIGHT_30};
    border-radius: 12px;
    padding: 4px 7px;
    font-size: 11px;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  .ant-tag:hover {
    background: ${COLORS.PRIMARY_LIGHT_20};
    border-color: ${COLORS.PRIMARY_LIGHT_50};
  }

  .ant-tag-checkable:hover:not(.ant-tag-checkable-checked) {
    background: ${COLORS.PRIMARY_LIGHT_15};
  }

  .ant-tag-checkable-checked {
    background: ${COLORS.PRIMARY};
    color: ${COLORS.BG_PRIMARY};
    border-color: ${COLORS.PRIMARY};
  }
`
