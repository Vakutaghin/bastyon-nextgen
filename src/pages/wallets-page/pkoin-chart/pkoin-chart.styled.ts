import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

const SIDEBAR_WIDTH = 200

export const SC_PkoinChartWrap = styled.div`
  width: 100%;
  padding: 20px 0;
`

export const SC_PkoinChartTitle = styled.h2`
  font-size: 16px;
  font-weight: 600;
  color: ${COLORS.GRAY_212};
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
  color: ${COLORS.GRAY_120};
  margin-right: 4px;
`

export const SC_PkoinChartFilterBtn = styled.button`
  font-size: 12px;
  font-weight: 500;
  color: ${COLORS.GRAY_212};
  background: ${COLORS.WHITE};
  border: 1px solid ${COLORS.OVERLAY_12};
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
  user-select: none;

  &:hover {
    background: ${COLORS.BG_LIGHT};
  }
  &.active {
    background: rgb(22, 119, 255);
    color: ${COLORS.WHITE};
    border-color: rgb(22, 119, 255);
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
  background: ${COLORS.WHITE};
  border: 1px solid ${COLORS.OVERLAY_8};
  border-radius: 10px;
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
  background: ${COLORS.BG_LIGHT};
  border: 1px solid ${COLORS.OVERLAY_8};
  border-radius: 10px;
`

export const SC_PkoinChartPriceLabel = styled.div`
  font-size: 12px;
  color: ${COLORS.GRAY_120};
  text-transform: uppercase;
  letter-spacing: 0.02em;
`

export const SC_PkoinChartPriceValue = styled.div`
  font-size: 28px;
  font-weight: 700;
  color: ${COLORS.GRAY_212};
  line-height: 1.2;
`

export const SC_PkoinChartChange = styled.div`
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;

  &.positive {
    color: rgb(34, 120, 60);
  }
  &.negative {
    color: rgb(180, 50, 50);
  }
  &.neutral {
    color: ${COLORS.GRAY_120};
  }
`

export const SC_PkoinChartStatRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

export const SC_PkoinChartStatLabel = styled.span`
  font-size: 11px;
  color: ${COLORS.GRAY_120};
  text-transform: uppercase;
  letter-spacing: 0.02em;
`

export const SC_PkoinChartStatValue = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: ${COLORS.GRAY_212};
`

export const SC_PkoinChartLoading = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: ${COLORS.GRAY_120};
  background: ${COLORS.WHITE};
`

export const SC_PkoinChartError = styled.div`
  padding: 16px;
  font-size: 14px;
  color: rgb(180, 50, 50);
  background: rgba(220, 53, 69, 0.08);
  border-radius: 8px;
  margin-top: 12px;
`

export const SC_PkoinChartLegend = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
  font-size: 13px;
  color: ${COLORS.GRAY_120};
`

export const SC_PkoinChartLegendPrice = styled.span`
  font-weight: 600;
  color: ${COLORS.GRAY_212};
`
