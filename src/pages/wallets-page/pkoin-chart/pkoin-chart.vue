<template>
  <SC_PkoinChartWrap>
    <SC_PkoinChartTitle>Курс PKOIN (USD)</SC_PkoinChartTitle>
    <SC_PkoinChartFilters>
      <SC_PkoinChartFilterGroup>
        <SC_PkoinChartFilterLabel>Период:</SC_PkoinChartFilterLabel>
        <SC_PkoinChartFilterBtn
          v-for="opt in periodOptions"
          :key="opt.value"
          type="button"
          :class="{ active: periodDays === opt.value }"
          @click="setPeriod(opt.value)"
        >
          {{ opt.label }}
        </SC_PkoinChartFilterBtn>
      </SC_PkoinChartFilterGroup>
    </SC_PkoinChartFilters>
    <SC_PkoinChartRow>
      <SC_PkoinChartArea>
        <SC_PkoinChartContainer>
          <div ref="containerRef" class="chart-inner" />
          <SC_PkoinChartLoading v-if="loading" class="chart-loading">
            Загрузка графика…
          </SC_PkoinChartLoading>
        </SC_PkoinChartContainer>
      </SC_PkoinChartArea>
      <SC_PkoinChartSidebar v-if="!error">
        <template v-if="loading">
          <SC_PkoinChartPriceLabel>Текущий курс</SC_PkoinChartPriceLabel>
          <SC_PkoinChartPriceValue>—</SC_PkoinChartPriceValue>
        </template>
        <template v-else-if="currentPrice != null">
          <SC_PkoinChartPriceLabel>Текущий курс</SC_PkoinChartPriceLabel>
          <SC_PkoinChartPriceValue>${{ currentPrice.toFixed(4) }}</SC_PkoinChartPriceValue>
          <template v-if="priceChange != null">
            <SC_PkoinChartStatRow>
              <SC_PkoinChartStatLabel>За {{ chartDaysLabel }}</SC_PkoinChartStatLabel>
              <SC_PkoinChartChange
                :class="priceChange > 0 ? 'positive' : priceChange < 0 ? 'negative' : 'neutral'"
              >
                {{ priceChange >= 0 ? '+' : '' }}{{ priceChange.toFixed(2) }}%
              </SC_PkoinChartChange>
            </SC_PkoinChartStatRow>
          </template>
          <template v-if="priceChange24h != null">
            <SC_PkoinChartStatRow>
              <SC_PkoinChartStatLabel>За 24 ч</SC_PkoinChartStatLabel>
              <SC_PkoinChartChange
                :class="priceChange24h > 0 ? 'positive' : priceChange24h < 0 ? 'negative' : 'neutral'"
              >
                {{ priceChange24h >= 0 ? '+' : '' }}{{ priceChange24h.toFixed(2) }}%
              </SC_PkoinChartChange>
            </SC_PkoinChartStatRow>
          </template>
          <template v-if="priceHigh30d != null">
            <SC_PkoinChartStatRow>
              <SC_PkoinChartStatLabel>Макс. за {{ chartDaysLabel }}</SC_PkoinChartStatLabel>
              <SC_PkoinChartStatValue>${{ priceHigh30d.toFixed(4) }}</SC_PkoinChartStatValue>
            </SC_PkoinChartStatRow>
          </template>
          <template v-if="priceLow30d != null">
            <SC_PkoinChartStatRow>
              <SC_PkoinChartStatLabel>Мин. за {{ chartDaysLabel }}</SC_PkoinChartStatLabel>
              <SC_PkoinChartStatValue>${{ priceLow30d.toFixed(4) }}</SC_PkoinChartStatValue>
            </SC_PkoinChartStatRow>
          </template>
        </template>
      </SC_PkoinChartSidebar>
    </SC_PkoinChartRow>
    <SC_PkoinChartError v-if="error">
      {{ error }}
    </SC_PkoinChartError>
  </SC_PkoinChartWrap>
</template>

<script lang="ts">
import pkoinChart from './pkoin-chart'
export default pkoinChart
</script>
