import styled from 'vue3-styled-components'

export const SC_Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

export const SC_Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

export const SC_SectionTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

/** «Осталось 380 МБ из 500 МБ» — главное число окна. */
export const SC_QuotaValue = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_Muted = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);

  &.error {
    color: var(--color-red-dark);
  }
`

/** Ступени лимита: размер слева, условие справа, своя — выделена. */
export const SC_Tiers = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 4px 8px;
    border-radius: var(--ui-radius-md);
    font-size: 13px;
    color: var(--color-text-primary);
  }

  li.current {
    background: var(--color-overlay-6);
  }
`

export const SC_TierSize = styled.span`
  flex: 0 0 64px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  white-space: nowrap;
`

export const SC_TierText = styled.span`
  flex: 1;
  min-width: 0;
`

export const SC_TierBadge = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: var(--ui-primary);
  white-space: nowrap;
`

export const SC_Rules = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: var(--color-text-primary);
`

export const SC_Footnote = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 4px;
  font-size: 13px;
  color: var(--color-text-secondary);

  .ant-btn-link {
    height: auto;
    padding: 0;
  }
`
