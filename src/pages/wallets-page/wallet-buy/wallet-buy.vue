<template>
  <SC_Buy>
    <PkoinChart @price="price = $event" />

    <SC_TopGrid>
      <!-- Калькулятор — только когда курс пришёл: без курса считать не от чего. -->
      <SC_Card v-if="price" data-testid="buy-calc">
        <SC_Head>
          <SC_HeadIcon aria-hidden="true"><SwapOutlined /></SC_HeadIcon>
          {{ t('walletBuy.calcTitle') }}
        </SC_Head>
        <SC_CalcRow>
          <SC_CalcField>
            <input
              :value="pkoinInput"
              inputmode="decimal"
              :aria-label="t('walletBuy.calcPkoin')"
              data-testid="buy-calc-pkoin"
              @input="onPkoinInput"
            />
            <SC_CalcUnit>PKOIN</SC_CalcUnit>
          </SC_CalcField>
          <SC_CalcSwap aria-hidden="true">⇄</SC_CalcSwap>
          <SC_CalcField>
            <input
              :value="usdInput"
              inputmode="decimal"
              :aria-label="t('walletBuy.calcUsd')"
              data-testid="buy-calc-usd"
              @input="onUsdInput"
            />
            <SC_CalcUnit>USD</SC_CalcUnit>
          </SC_CalcField>
        </SC_CalcRow>
        <SC_Muted>{{ t('walletBuy.calcNote') }}</SC_Muted>
      </SC_Card>

      <SC_Card v-if="address" data-testid="buy-address">
        <SC_Head>
          <SC_HeadIcon aria-hidden="true"><QrcodeOutlined /></SC_HeadIcon>
          {{ t('walletBuy.addressTitle') }}
        </SC_Head>
        <SC_AddressBody>
          <img v-if="qrDataUrl" :src="qrDataUrl" :alt="t('walletBuy.qrAlt')" />
          <SC_AddressMain>
            <SC_AddressRow>
              <SC_Address data-testid="buy-address-value">{{ address }}</SC_Address>
            </SC_AddressRow>
            <SC_AddressRow>
              <SC_Button type="button" data-testid="buy-address-copy" @click="copyAddress">
                <CheckOutlined v-if="copied" /><CopyOutlined v-else />
                {{ copied ? t('walletBuy.copied') : t('walletBuy.copy') }}
              </SC_Button>
            </SC_AddressRow>
            <SC_Muted>{{ t('walletBuy.addressHint') }}</SC_Muted>
          </SC_AddressMain>
        </SC_AddressBody>
      </SC_Card>
    </SC_TopGrid>

    <SC_Section data-testid="buy-exchanges">
      <SC_Head>
        <SC_HeadIcon aria-hidden="true"><RiseOutlined /></SC_HeadIcon>
        {{ t('walletBuy.exchangesTitle') }}
      </SC_Head>
      <SC_Text>{{ t('walletBuy.exchangesText') }}</SC_Text>
      <SC_Venues>
        <SC_VenueLink
          v-for="ex in PKOIN_EXCHANGES"
          :key="ex.id"
          :href="ex.url"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="buy-exchange"
          @click.prevent="openExternal(ex.url)"
        >
          <SC_VenueBadge aria-hidden="true">{{ ex.name.charAt(0) }}</SC_VenueBadge>
          <SC_VenueBody>
            <SC_VenueName>{{ ex.name }}</SC_VenueName>
            <SC_VenueMeta>{{ ex.pair }}</SC_VenueMeta>
          </SC_VenueBody>
          <SC_VenueAction>{{ t('walletBuy.open') }} <GlobalOutlined /></SC_VenueAction>
        </SC_VenueLink>
      </SC_Venues>
      <SC_Muted>{{ t('walletBuy.exchangesThin') }}</SC_Muted>
      <SC_ExtLink
        :href="COINGECKO_MARKETS_URL"
        target="_blank"
        rel="noopener noreferrer"
        @click.prevent="openExternal(COINGECKO_MARKETS_URL)"
        >{{ t('walletBuy.exchangesListNote') }} ↗</SC_ExtLink
      >
    </SC_Section>

    <SC_Section data-testid="buy-p2p">
      <SC_Head>
        <SC_HeadIcon aria-hidden="true"><TeamOutlined /></SC_HeadIcon>
        {{ t('walletBuy.p2pTitle') }}
      </SC_Head>
      <SC_Venues>
        <SC_VenueRoute :to="exchangeAppRoute" data-testid="buy-p2p-exchange">
          <SC_VenueBadge aria-hidden="true"><SwapOutlined /></SC_VenueBadge>
          <SC_VenueBody>
            <SC_VenueName>PKOIN Exchange</SC_VenueName>
            <SC_VenueMeta>{{ t('walletBuy.p2pExchangeText') }}</SC_VenueMeta>
          </SC_VenueBody>
          <SC_VenueAction aria-hidden="true"><RightOutlined /></SC_VenueAction>
        </SC_VenueRoute>
        <SC_VenueRoute :to="commerceRoute" data-testid="buy-p2p-commerce">
          <SC_VenueBadge aria-hidden="true">#</SC_VenueBadge>
          <SC_VenueBody>
            <SC_VenueName>#{{ EXCHANGE_TAG }}</SC_VenueName>
            <SC_VenueMeta>{{ t('walletBuy.p2pCommerceText') }}</SC_VenueMeta>
          </SC_VenueBody>
          <SC_VenueAction aria-hidden="true"><RightOutlined /></SC_VenueAction>
        </SC_VenueRoute>
      </SC_Venues>
      <SC_Risk role="note" data-testid="buy-risk">
        <WarningOutlined aria-hidden="true" />
        <span>
          <strong>{{ t('walletBuy.riskTitle') }}</strong>
          {{ t('walletBuy.riskText') }}
        </span>
      </SC_Risk>
    </SC_Section>

    <SC_Section data-testid="buy-tools">
      <SC_Head>
        <SC_HeadIcon aria-hidden="true"><WalletOutlined /></SC_HeadIcon>
        {{ t('walletBuy.toolsTitle') }}
      </SC_Head>
      <SC_Tools>
        <li>
          <SC_Tool :to="tabRoute('transfers')">
            <SendOutlined aria-hidden="true" />{{ t('walletBuy.toolSend') }}
          </SC_Tool>
        </li>
        <li>
          <SC_Tool :to="tabRoute('history')">
            <ClockCircleOutlined aria-hidden="true" />{{ t('walletBuy.toolHistory') }}
          </SC_Tool>
        </li>
        <li v-if="address">
          <SC_Tool :to="{ name: 'explorer-address', params: { address } }">
            <BlockOutlined aria-hidden="true" />{{ t('walletBuy.toolExplorer') }}
          </SC_Tool>
        </li>
        <li>
          <SC_Tool :to="tabRoute('earnings')">
            <DollarOutlined aria-hidden="true" />{{ t('walletBuy.toolEarnings') }}
          </SC_Tool>
        </li>
        <li>
          <SC_Tool :to="{ name: 'limits' }">
            <SafetyCertificateOutlined aria-hidden="true" />{{ t('walletBuy.toolLimits') }}
          </SC_Tool>
        </li>
        <SC_ToolHelp>
          <!-- Статья открывается сбоку: вкладка остаётся на экране. -->
          <HelpLink topic="how-to-buy-pkoin" :label="t('walletBuy.toolHelp')" />
        </SC_ToolHelp>
      </SC_Tools>
    </SC_Section>
  </SC_Buy>
</template>

<script setup lang="ts">
// Вкладка кошелька «Покупка/продажа»: курс и калькулятор, свой адрес для
// получения, биржи, сделки у продавцов (PKOIN Exchange и объявления
// #pkoin_commerce) с предупреждением о рисках и полезные ссылки. Площадки —
// в pkoin-venues.ts. Своих сделок экран не ведёт: только ведёт туда, где они идут.
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RouteLocationRaw } from 'vue-router'
import PkoinChart from '../pkoin-chart/pkoin-chart.vue'
import { useReceiveAddress } from '../wallet-transfer/use-receive-address'
import HelpLink from '@/b-components/help/help-link.vue'
import { EXCHANGE_TAG } from '@/b-components/content/post-composer/validate-post'
import { openExternal } from '@/helpers/common/open-external'
import {
  BlockOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  DollarOutlined,
  GlobalOutlined,
  QrcodeOutlined,
  RightOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  SwapOutlined,
  TeamOutlined,
  WalletOutlined,
  WarningOutlined,
} from '@/components/icons'
import { COINGECKO_MARKETS_URL, PKOIN_EXCHANGES, PKOIN_EXCHANGE_APP_ID } from './pkoin-venues'
import {
  formatAmount,
  parseAmount,
  pkoinToUsd,
  PKOIN_DIGITS,
  usdToPkoin,
  USD_DIGITS,
} from './pkoin-calc'
import {
  SC_Address,
  SC_AddressBody,
  SC_AddressMain,
  SC_AddressRow,
  SC_Buy,
  SC_Button,
  SC_CalcField,
  SC_CalcRow,
  SC_CalcSwap,
  SC_CalcUnit,
  SC_Card,
  SC_ExtLink,
  SC_Head,
  SC_HeadIcon,
  SC_Muted,
  SC_Risk,
  SC_Section,
  SC_Text,
  SC_Tool,
  SC_ToolHelp,
  SC_Tools,
  SC_TopGrid,
  SC_VenueAction,
  SC_VenueBadge,
  SC_VenueBody,
  SC_VenueLink,
  SC_VenueMeta,
  SC_VenueName,
  SC_VenueRoute,
  SC_Venues,
} from './wallet-buy.styled'

const { t } = useI18n()

// Адрес и QR — сразу, без кнопки «Показать»: на этой вкладке за ним и приходят.
const receive = useReceiveAddress()
receive.showReceiveAddress.value = true
const { copied, qrDataUrl, copyAddress } = receive
const address = receive.selectedReceiveAddress

const exchangeAppRoute: RouteLocationRaw = `/app/${PKOIN_EXCHANGE_APP_ID}`
const commerceRoute: RouteLocationRaw = {
  path: '/search',
  query: { q: `#${EXCHANGE_TAG}`, type: 'posts' },
}

function tabRoute(tab: string): RouteLocationRaw {
  return { name: 'wallets', query: { tab } }
}

// Калькулятор: правится одно поле — пересчитывается другое. Сменился курс —
// пересчитывается то, что не вводили руками.
const DEFAULT_PKOIN = 100
const price = ref<number | null>(null)
const pkoinInput = ref(String(DEFAULT_PKOIN))
const usdInput = ref('')
let lastEdited: 'pkoin' | 'usd' = 'pkoin'

function recalc(): void {
  const p = price.value
  if (!p) return
  if (lastEdited === 'pkoin') {
    const n = parseAmount(pkoinInput.value)
    usdInput.value = n === null ? '' : formatAmount(pkoinToUsd(n, p), USD_DIGITS)
  } else {
    const n = parseAmount(usdInput.value)
    pkoinInput.value = n === null ? '' : formatAmount(usdToPkoin(n, p), PKOIN_DIGITS)
  }
}

function onPkoinInput(e: Event): void {
  pkoinInput.value = (e.target as HTMLInputElement).value
  lastEdited = 'pkoin'
  recalc()
}

function onUsdInput(e: Event): void {
  usdInput.value = (e.target as HTMLInputElement).value
  lastEdited = 'usd'
  recalc()
}

watch(price, recalc)
</script>
