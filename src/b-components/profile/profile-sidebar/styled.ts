import styled from 'vue3-styled-components'

export const SC_ProfileSidebar = styled.div`
  width: 280px;
  min-width: 280px;
  height: fit-content;
  background: rgb(255, 255, 255);
  display: flex;
  flex-direction: column;
  position: sticky;
  align-self: flex-start;
  flex-shrink: 0;
  top: 60px;
  border-radius: 8px;
  padding: 20px;
  z-index: 10;

  @media (max-width: 800px) {
    display: none;
  }
`

export const SC_UserAvatar = styled.div`
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  margin: 0 auto 20px;
  border: 4px solid #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);

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
  background: #f0f2f5;
  color: #aeb8c2;
  font-size: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  border: 4px solid #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
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
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
`

export const SC_UserAddress = styled.div`
  font-size: 12px;
  color: #999;
  word-break: break-all;
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  padding: 5px 0;
  border-top: 1px solid #eee;

  &:hover {
    color: #666;
  }

  i {
    font-size: 14px;
  }
`

export const SC_UserSite = styled.a`
  font-size: 13px;
  color: #00a4ff;
  text-decoration: none;
  word-break: break-all;
  display: flex;
  align-items: center;
  gap: 5px;
  border: 0;

  &:hover {
    text-decoration: underline;
  }
`

export const SC_StatItem = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 14px;
`

export const SC_StatLabel = styled.span`
  color: #666;
`

export const SC_StatValue = styled.span`
  font-weight: 600;
`

export const SC_UserAbout = styled.div`
  margin-bottom: 20px;
  font-size: 14px;
  color: #333;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;

  a {
    color: #00a4ff;
    text-decoration: none;

    &:hover {
      text-decoration: none;
      opacity: 0.8;
    }
  }
`

export const SC_UserJoined = styled.div`
  font-size: 12px;
  color: #999;
  text-align: center;
`

export const SC_LoadingState = styled.div`
  text-align: center;
  padding: 20px;
  color: #999;
`
