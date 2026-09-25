import styled from 'vue3-styled-components'

export const SC_PostEmbed = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--ui-radius-lg);
  background: var(--color-bg-primary);
  width: 100%;
  max-width: min(320px, 100%);
  overflow: hidden;
  cursor: pointer;
  transition: border-color var(--transition-quick);

  &:hover {
    border-color: var(--color-brand-cyan);
  }
`

export const SC_Header = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 6px;
  min-width: 0;
`

export const SC_Avatar = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-bg-tertiary);
  flex-shrink: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-white);
  font-weight: 500;
  font-size: 12px;
`

export const SC_AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`

export const SC_HeaderInfo = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1 1 auto;
`

export const SC_AuthorName = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text-highlighted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_BadgeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-blue-gray);
`

export const SC_Body = styled.div`
  padding: 4px 12px 10px;
`

export const SC_Title = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  line-height: 1.3;
  margin-bottom: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

export const SC_Snippet = styled.div`
  font-size: 14px;
  color: var(--color-text-dark);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
`

export const SC_Thumb = styled('div', { aspect: String })`
  width: 100%;
  aspect-ratio: ${(p) => p.aspect || '16 / 9'};
  background: var(--color-bg-secondary);
  position: relative;
  overflow: hidden;
`

export const SC_ThumbImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`

export const SC_VideoBadge = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
`

export const SC_VideoIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-overlay-55);
  display: flex;
  align-items: center;
  justify-content: center;

  &::before {
    content: '';
    width: 0;
    height: 0;
    border-left: 14px solid var(--color-white);
    border-top: 9px solid transparent;
    border-bottom: 9px solid transparent;
    margin-left: 4px;
  }
`

export const SC_Loading = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  color: var(--color-blue-gray);
  font-size: 14px;
`

export const SC_Spinner = styled.div`
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-bg-tertiary);
  border-top-color: var(--color-brand-cyan);
  border-radius: 50%;
  animation: spin 1s linear infinite; /* @keyframes spin — глобально в style.css */
`

export const SC_ShortTxid = styled.span`
  opacity: 0.6;
  font-size: 12px;
  margin-left: auto;
`

export const SC_FailedHint = styled.a`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  text-decoration: none;
  color: var(--color-brand-cyan);
  font-size: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--ui-radius-lg);
  background: var(--color-bg-primary);
  width: 100%;
  max-width: min(320px, 100%);
  box-sizing: border-box;

  &:hover {
    background: var(--color-bg-hover-blue);
  }
`
