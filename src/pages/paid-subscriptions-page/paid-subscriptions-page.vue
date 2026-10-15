<template>
  <SC_PaidWork>
    <SC_PaidPage>
      <SC_PaidTitle>{{ t('paidSubscriptions.title') }}</SC_PaidTitle>

      <SC_PaidTabs role="tablist">
        <SC_PaidTab
          v-for="tab in TABS"
          :key="tab"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab"
          :class="{ active: activeTab === tab }"
          @click="selectTab(tab)"
        >
          {{ t(`paidSubscriptions.tabs.${tab}`) }}
        </SC_PaidTab>
      </SC_PaidTabs>

      <MySubscriptionsTab v-if="activeTab === 'subscriptions'" />
      <MySubscribersTab v-else />
    </SC_PaidPage>
  </SC_PaidWork>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import MySubscriptionsTab from './my-subscriptions-tab.vue'
import MySubscribersTab from './my-subscribers-tab.vue'
import {
  SC_PaidWork,
  SC_PaidPage,
  SC_PaidTitle,
  SC_PaidTabs,
  SC_PaidTab,
} from './paid-subscriptions-page.styled'

defineOptions({ name: 'PaidSubscriptionsPage' })

/** «Мои подписки» — авторы, которым я плачу; «Мои подписчики» — цена и кто платит мне. */
const TABS = ['subscriptions', 'subscribers'] as const
type Tab = (typeof TABS)[number]

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

// Вкладка — в адресе (?tab=subscribers): ссылка из своего профиля и из уведомления.
const activeTab = ref<Tab>(route.query.tab === 'subscribers' ? 'subscribers' : 'subscriptions')

// Переход сюда же с другой вкладкой (уведомление при открытой странице).
watch(
  () => route.query.tab,
  (tab) => {
    activeTab.value = tab === 'subscribers' ? 'subscribers' : 'subscriptions'
  }
)

function selectTab(tab: Tab): void {
  activeTab.value = tab
  void router.replace({ query: { ...route.query, tab } })
}
</script>
