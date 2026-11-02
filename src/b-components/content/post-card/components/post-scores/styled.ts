import styled from 'vue3-styled-components'

/** Доли оценок от 5 до 1 — над списком, как в прежнем Bastyon. */
export const SC_Shares = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 10px 14px;
  border-bottom: 1px solid var(--ui-border);
  margin-bottom: 8px;
`

export const SC_ShareRow = styled.div`
  display: grid;
  grid-template-columns: 36px 1fr 40px;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--ui-text-muted);
`

export const SC_ShareLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--ui-text);

  svg {
    width: 12px;
    height: 12px;
    color: var(--color-warning);
  }
`

export const SC_ShareTrack = styled.span`
  display: block;
  height: 6px;
  border-radius: var(--ui-radius-full);
  background: var(--ui-bg-elevated);
  overflow: hidden;
`

export const SC_ShareFill = styled('span', { percent: Number })`
  display: block;
  height: 100%;
  width: ${(p: { percent: number }) => p.percent}%;
  border-radius: var(--ui-radius-full);
  background: var(--color-warning);
`

export const SC_ShareCount = styled.span`
  text-align: right;
  font-variant-numeric: tabular-nums;
`

/** Оценка человека справа в строке: «5 ★». */
export const SC_Score = styled.span`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text-highlighted);
  font-variant-numeric: tabular-nums;

  svg {
    width: 15px;
    height: 15px;
    color: var(--color-warning);
  }
`

export const SC_Retry = styled.button`
  margin-top: 10px;
  padding: 6px 14px;
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--color-border-default);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-size: 14px;
  cursor: pointer;
`
