import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_PostHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
`

export const SC_PostAuthor = styled.div`
  display: flex;
  align-items: center;
  gap: 11px;

  a {
    border: 0;
  }
`

export const SC_PostAuthorInfo = styled.div`
  display: flex;
  flex-direction: column;
`

export const SC_PostAuthorName = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_PostAuthorRep = styled.div`
  color: ${COLORS.TEXT_SECONDARY};
  border: 1px solid ${COLORS.BORDER_DARK};
  border-radius: 6px;
  padding: 0 6px;
  line-height: 1.4;
  font-weight: 500;
  font-size: 14px;
`

export const SC_PostTime = styled.time`
  font-size: 11px;
  color: ${COLORS.TEXT_SECONDARY};
  margin-top: 2px;
`

export const SC_AuthorNameRow = styled.div`
  display: flex;
  align-items: center;
  text-decoration: none;
  gap: 8px;

  a {
    border-bottom: 0;
  }
`

export const SC_ChatBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  margin: 0;
  border: none;
  background: transparent;
  color: ${COLORS.TEXT_SECONDARY};
  cursor: pointer;
  border-radius: 4px;
  line-height: 1;

  &:hover {
    color: ${COLORS.BRAND_CYAN};
    background: ${COLORS.BRAND_CYAN_LIGHT};
  }
`

export const SC_FollowBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  margin: 0;
  border: none;
  background: transparent;
  color: ${COLORS.TEXT_SECONDARY};
  cursor: pointer;
  border-radius: 4px;
  line-height: 1;

  &:hover {
    color: ${COLORS.BRAND_CYAN};
    background: ${COLORS.BRAND_CYAN_LIGHT};
  }

  &.following {
    color: ${COLORS.BRAND_CYAN};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .anticon {
    font-size: 16px;
  }
`

export const SC_PostBookmark = styled.div`
  margin-left: auto;
  cursor: pointer;
  padding: 0 10px;
`

export const SC_AuthorLinkWrap = styled.div`
  display: block;
`

export const SC_RepostLine = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};

  .repost-icon {
    font-size: 12px;
    color: ${COLORS.TEXT_SECONDARY};
  }

  .repost-text {
    font-weight: 500;
  }

  .repost-from {
    color: ${COLORS.TEXT_SECONDARY};
  }

  .repost-author {
    color: ${COLORS.BRAND_CYAN};
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  .repost-record {
    color: ${COLORS.TEXT_SECONDARY};
  }
`
