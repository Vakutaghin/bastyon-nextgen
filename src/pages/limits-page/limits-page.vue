<template>
  <SC_LimitsWork>
    <SC_LimitsPage>
      <SC_LimitsTitle>Мои лимиты</SC_LimitsTitle>

      <SC_LimitsLoading v-if="showLoading">
        Загрузка лимитов...
      </SC_LimitsLoading>

      <SC_LimitsError v-else-if="isError && !hasAnyData">
        {{ error?.message || 'Не удалось загрузить лимиты' }}
      </SC_LimitsError>

      <template v-else-if="hasAnyData">
        <SC_LimitsList>
          <SC_LimitRow v-if="reputationValue != null">
            <SC_LimitLabel>Репутация</SC_LimitLabel>
            <SC_LimitValue>{{ reputationValue }}</SC_LimitValue>
          </SC_LimitRow>
          <SC_LimitRow v-if="statusValue != null">
            <SC_LimitLabel>Статус</SC_LimitLabel>
            <SC_LimitValue>{{ statusValue }}</SC_LimitValue>
          </SC_LimitRow>
          <SC_LimitRow v-for="row in limitRows" :key="row.key">
            <SC_LimitLabel>{{ row.label }}</SC_LimitLabel>
            <span>
              <SC_LimitValue>{{ row.unspent }}</SC_LimitValue>
              <SC_LimitValueMuted> / {{ row.total }}</SC_LimitValueMuted>
            </span>
          </SC_LimitRow>
        </SC_LimitsList>
      </template>

      <SC_LimitsLoading v-else>
        Нет данных о лимитах. Проверьте подключение или повторите позже.
      </SC_LimitsLoading>
    </SC_LimitsPage>
  </SC_LimitsWork>
</template>

<script lang="ts">
import limitsPage from './limits-page'

export default limitsPage
</script>
