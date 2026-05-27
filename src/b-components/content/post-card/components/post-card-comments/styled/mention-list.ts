import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_MentionList = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  margin-top: 4px;
  max-height: 180px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 10;
`

export const SC_MentionItem = styled.button`
  display: block;
  width: 100%;
  padding: 8px 14px;
  border: none;
  background: none;
  text-align: left;
  font-size: 14px;
  color: ${COLORS.TEXT_PRIMARY};
  cursor: pointer;

  &:hover {
    background: #f0f0f0;
  }

  &.mention-item--highlighted {
    background: #e6f4ff;
  }
`
