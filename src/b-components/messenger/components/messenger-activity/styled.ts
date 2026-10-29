import styled from 'vue3-styled-components'

/** Значок и подпись «догружается» в шапке мессенджера. */
export const SC_Activity = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex-shrink: 1;
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 400;
`

export const SC_ActivitySpinner = styled.span`
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  border: 2px solid var(--ui-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite; /* @keyframes spin — глобально в style.css */
`

export const SC_ActivityText = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`
