import styled from 'vue3-styled-components'

export const SC_LinkPreview = styled.a`
  display: flex;
  text-decoration: none;
  border-left: 3px solid var(--color-brand-cyan);
  background: var(--color-brand-cyan-soft);
  border-radius: 0 var(--ui-radius-lg) var(--ui-radius-lg) 0;
  padding: 8px 10px;
  margin-top: 4px;
  width: 100%;
  max-width: min(320px, 100%);
  box-sizing: border-box;
  color: var(--color-text-primary);
  gap: 10px;
  align-items: flex-start;
  cursor: pointer;
  overflow: hidden;

  &:hover {
    background: var(--color-brand-cyan-light);
  }
`

export const SC_Body = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`

export const SC_SiteName = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: var(--color-brand-cyan);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_Title = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

export const SC_Description = styled.div`
  font-size: 12px;
  color: var(--color-text-dark);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

/** Обёртка превью-картинки: внутри TorImage (под Tor — заглушка, не <img>). */
export const SC_Thumb = styled.div`
  width: 64px;
  height: 64px;
  border-radius: var(--ui-radius-md);
  flex-shrink: 0;
  overflow: hidden;
  background: var(--color-bg-secondary);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  button {
    min-height: 64px;
    padding: 4px;
    font-size: 10px;
    border-radius: var(--ui-radius-md);
  }
`
