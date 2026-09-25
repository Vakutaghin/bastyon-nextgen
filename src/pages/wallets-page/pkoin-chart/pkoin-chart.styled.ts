import styled from 'vue3-styled-components'

const SIDEBAR_WIDTH = 200

export const SC_PkoinChartWrap = styled.div`
  width: 100%;
  padding: 20px 0;
`

export const SC_PkoinChartTitle = styled.h2`
  font-size: 16px;
  font-weight: 600;
  color: var(--color-gray-212);
  margin: 0 0 16px;
`

export const SC_PkoinChartFilters = styled.div`
  margin-top: 20px;
  margin-bottom: 16px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px 24px;
`

export const SC_PkoinChartFilterGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`

export const SC_PkoinChartFilterLabel = styled.span`
  font-size: 12px;
  color: var(--color-gray-120);
  margin-right: 4px;
`

export const SC_PkoinChartFilterBtn = styled.button`
  font-size: 12px;
  font-weight: 500;
  color: var(--color-gray-212);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-overlay-12);
  border-radius: var(--ui-radius-md);
  padding: 6px 10px;
  cursor: pointer;
  user-select: none;

  &:hover {
    background: var(--color-bg-light);
  }

  &.active {
    background: var(--color-primary);
    color: var(--color-white);
    border-color: var(--color-primary);
  }
`

export const SC_PkoinChartRow = styled.div`
  display: flex;
  align-items: stretch;
  gap: 20px;
  width: 100%;
  min-height: 280px;
  user-select: none;
`

export const SC_PkoinChartArea = styled.div`
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  user-select: none;
`

export const SC_PkoinChartContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 260px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-overlay-8);
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
  user-select: none;

  .chart-inner {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    user-select: none;
  }

  .chart-inner svg {
    user-select: none;
  }
`

export const SC_PkoinChartSidebar = styled.aside`
  width: ${SIDEBAR_WIDTH}px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 16px;
  padding: 20px 16px;
  background: var(--color-bg-light);
  border: 1px solid var(--color-overlay-8);
  border-radius: var(--ui-radius-lg);
`

export const SC_PkoinChartPriceLabel = styled.div`
  font-size: 12px;
  color: var(--color-gray-120);
  text-transform: uppercase;
  letter-spacing: 0.02em;
`

export const SC_PkoinChartPriceValue = styled.div`
  font-size: 28px;
  font-weight: 700;
  color: var(--color-gray-212);
  line-height: 1.2;
`

export const SC_PkoinChartChange = styled.div`
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;

  &.positive {
    color: var(--color-success-deep);
  }

  &.negative {
    color: var(--color-danger-deep);
  }

  &.neutral {
    color: var(--color-gray-120);
  }
`

export const SC_PkoinChartStatRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

export const SC_PkoinChartStatLabel = styled.span`
  font-size: 11px;
  color: var(--color-gray-120);
  text-transform: uppercase;
  letter-spacing: 0.02em;
`

export const SC_PkoinChartStatValue = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: var(--color-gray-212);
`

export const SC_PkoinChartLoading = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--color-gray-120);
  background: var(--color-bg-primary);
`

export const SC_PkoinChartError = styled.div`
  padding: 16px;
  font-size: 14px;
  color: var(--color-danger-deep);
  background: var(--color-danger-bg-soft);
  border-radius: var(--ui-radius-lg);
  margin-top: 12px;
`
