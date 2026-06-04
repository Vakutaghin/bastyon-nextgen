import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_ProfileSidebar = styled.div`
  width: 280px;
  min-width: 280px;
  height: fit-content;
  background: ${COLORS.BG_PRIMARY};
  display: flex;
  flex-direction: column;
  position: sticky;
  align-self: flex-start;
  flex-shrink: 0;
  top: 60px;
  border-radius: 8px;
  padding: 20px 0 20px 20px;
  z-index: 10;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    display: none;
  }
`

export const SC_UserAvatar = styled.div`
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  margin: 0 auto 20px;
  border: 4px solid ${COLORS.WHITE};
  box-shadow: ${COLORS.SHADOW_SM};

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export const SC_UserAvatarPlaceholder = styled.div`
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: ${COLORS.GRAY_F0};
  color: ${COLORS.GRAY_AAA};
  font-size: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  border: 4px solid ${COLORS.WHITE};
  box-shadow: ${COLORS.SHADOW_SM};
`

export const SC_UserName = styled.h2`
  text-align: center;
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 20px;
  word-break: break-word;
`

export const SC_UserStats = styled.div`
  display: flex;
  flex-direction: row;
  gap: 12px;
  justify-content: space-between;
  margin: 12px 0 20px;
`

export const SC_StartChatButton = styled.button`
  width: 100%;
  margin: 0 20px 16px 0;
  padding: 10px 14px;
  border-radius: 8px;
  border: none;
  background-color: ${COLORS.BRAND_CYAN};
  color: ${COLORS.WHITE};
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 2px 6px ${COLORS.BRAND_CYAN_LIGHT};

  &:hover {
    background-color: ${COLORS.BRAND_CYAN_HOVER};
  }

  &:disabled {
    background-color: ${COLORS.GRAY_CCC};
    cursor: not-allowed;
    box-shadow: none;
  }
`

export const SC_SubscribeRow = styled.div`
  display: flex;
  gap: 8px;
  margin: 0 20px 12px 0;
`

export const SC_SubscribeButton = styled.button`
  flex: 1;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid ${COLORS.BRAND_CYAN};
  background-color: ${COLORS.BRAND_CYAN};
  color: ${COLORS.WHITE};
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition:
    background-color 0.2s,
    color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  &:hover {
    background-color: ${COLORS.BRAND_CYAN_HOVER};
  }

  &.subscribed {
    background-color: transparent;
    color: ${COLORS.BRAND_CYAN};
  }

  &.subscribed:hover {
    background-color: ${COLORS.BRAND_CYAN_LIGHT};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .anticon {
    font-size: 14px;
  }
`

export const SC_BellButton = styled.button`
  flex: 0 0 auto;
  width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid ${COLORS.BORDER};
  background-color: transparent;
  color: ${COLORS.TEXT_SECONDARY};
  cursor: pointer;
  transition:
    color 0.2s,
    border-color 0.2s,
    background-color 0.2s;

  &:hover {
    border-color: ${COLORS.BRAND_CYAN};
    color: ${COLORS.BRAND_CYAN};
  }

  &.active {
    border-color: ${COLORS.BRAND_CYAN};
    color: ${COLORS.BRAND_CYAN};
    background-color: ${COLORS.BRAND_CYAN_LIGHT};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .anticon {
    font-size: 16px;
  }
`

export const SC_UserAddress = styled.div`
  font-size: 12px;
  color: ${COLORS.GRAY_999};
  word-break: break-all;
  display: flex;
  align-items: center;
  cursor: pointer;
  margin-top: 10px;
`

export const SC_ExplorerLinkRow = styled.div`
  margin-top: 4px;
  margin-bottom: 8px;
`

export const SC_ExplorerLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: ${COLORS.PRIMARY};
  text-decoration: none;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`

export const SC_UserSite = styled.a`
  font-size: 13px;
  color: ${COLORS.BRAND_CYAN};
  text-decoration: none;
  word-break: break-all;
  display: flex;
  align-items: center;
  border: 0;

  &:hover {
    text-decoration: underline;
  }
`

export const SC_StatItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  min-width: 70px;
`

export const SC_StatLabel = styled.span`
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
  line-height: 1.2;
`

export const SC_StatValue = styled.span`
  margin-top: 2px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
  line-height: 1.2;
`

export const SC_UserAbout = styled.div`
  margin-top: 20px;
  font-size: 14px;
  color: ${COLORS.TEXT_PRIMARY};
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;

  a {
    color: ${COLORS.BRAND_CYAN};
    text-decoration: none;

    &:hover {
      text-decoration: none;
      opacity: 0.8;
    }
  }
`

export const SC_UserJoined = styled.div`
  font-size: 12px;
  color: ${COLORS.GRAY_999};
`

export const SC_LoadingState = styled.div`
  text-align: center;
  padding: 20px;
  color: ${COLORS.GRAY_999};
`
