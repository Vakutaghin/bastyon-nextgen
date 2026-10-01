<template>
  <Modal
    :open="boostStore.isOpen"
    :width="440"
    :centered="true"
    :closable="!sending"
    :mask-closable="!sending"
    :z-index="2700"
    :title="t('boost.title')"
    @cancel="handleCancel"
  >
    <SC_ModalBody>
      <SC_BoostBody>
        <SC_PostPreview v-if="preview">«{{ preview }}»</SC_PostPreview>

        <SC_Intro>
          {{ t('boost.intro') }}
          <HelpLink topic="boost" :label="t('boost.howItWorks')" />
        </SC_Intro>

        <SC_CurrentBoost v-if="currentBoost > 0">
          {{ t('boost.current', { amount: formatPkoinAmount(currentBoost) }) }}
        </SC_CurrentBoost>

        <SC_PresetRow>
          <SC_PresetBtn
            v-for="preset in PRESETS"
            :key="preset"
            type="button"
            :class="{ active: numericAmount === preset }"
            :disabled="sending"
            @click="amount = String(preset)"
          >
            {{ preset }}
          </SC_PresetBtn>
        </SC_PresetRow>

        <SC_AmountInput
          v-model="amount"
          type="number"
          step="0.01"
          :min="BOOST_MIN_PKOIN"
          inputmode="decimal"
          :aria-label="t('boost.amountPlaceholder', { min: minLabel })"
          :placeholder="t('boost.amountPlaceholder', { min: minLabel })"
          :disabled="sending"
        />

        <SC_BalanceHint v-if="balance !== null">
          {{ t('boost.available', { amount: formatPkoinAmount(balance, 4) }) }}
        </SC_BalanceHint>

        <SC_FieldError v-if="validationError">
          {{ validationError }}
          <HelpLink v-if="insufficient" topic="how-to-buy-pkoin" :label="t('boost.howToBuy')" />
        </SC_FieldError>

        <SC_Forecast aria-live="polite">
          <template v-if="forecast !== null">
            <span>
              {{
                t('boost.probability', {
                  top: BOOST_TOP_POSTS,
                  language: languageName,
                  percent: formatPercent(forecast),
                })
              }}
            </span>
            <SC_ForecastAction
              v-if="fullAmount && forecast < 1"
              type="button"
              :disabled="sending"
              @click="amount = String(fullAmount)"
            >
              {{ t('boost.forFull', { amount: formatPkoinAmount(fullAmount) }) }}
            </SC_ForecastAction>
          </template>
          <span v-else-if="standingsLoading">{{ t('boost.probabilityLoading') }}</span>
          <span v-else>{{ t('boost.probabilityUnknown') }}</span>
        </SC_Forecast>
      </SC_BoostBody>
    </SC_ModalBody>

    <template #footer>
      <SC_ModalActions>
        <Button type="default" :disabled="sending" @click="handleCancel">
          {{ t('boost.cancel') }}
        </Button>
        <Button type="primary" :loading="sending" :disabled="!canSend" @click="onSend">
          {{ t('boost.send') }}
        </Button>
      </SC_ModalActions>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal, Button } from 'ant-design-vue'
import { appToast } from '@/b-components/app-toast'
import HelpLink from '@/b-components/help/help-link.vue'
import { useBoostStore } from '@/stores/boost-store'
import { useEffectsStore } from '@/stores/effects-store'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { DEFAULT_TX_FEE, fromSatoshis } from '@/blockchain/constants/transactions'
import {
  getUnspents,
  filterAvailableUnspents,
} from '@/blockchain/core/transactions/unspents-manager'
import { SC_ModalBody, SC_ModalActions } from '@/components/modal'
import {
  BOOST_MIN_PKOIN,
  BOOST_TOP_POSTS,
  boostAmountFor,
  boostProbability,
  boostShares,
  type BoostStanding,
} from '@/helpers/content/boost'
import { formatPkoinAmount } from '@/helpers/common/pkoin-formatter'
import { fetchBoostFeed } from '@/services/boost-feed'
import { bcp47, LOCALE_NAMES, SUPPORTED_LOCALES, type Locale } from '@/i18n'
// Поля суммы — общие с окном чаевых: оба окна про деньги и выглядят одинаково.
import {
  SC_PresetRow,
  SC_PresetBtn,
  SC_AmountInput,
  SC_BalanceHint,
  SC_FieldError,
} from '@/b-components/donate/styled'
import donateSound from '@/b-components/donate/sounds/donate.mp3'
import {
  SC_BoostBody,
  SC_PostPreview,
  SC_Intro,
  SC_CurrentBoost,
  SC_Forecast,
  SC_ForecastAction,
} from './styled'

/** Быстрые суммы, PKOIN: от минимума старого клиента. */
const PRESETS = [BOOST_MIN_PKOIN, 5, 10, 25]

const { t, locale } = useI18n()
const boostStore = useBoostStore()
const effectsStore = useEffectsStore()
const authStore = useAuthStore()

const amount = ref('')
const sending = ref(false)
const balance = ref<number | null>(null)
/** Бусты ленты языка поста; `null` — ещё не пришли или не удалось. */
const standings = ref<BoostStanding[] | null>(null)
const standingsLoading = ref(false)

const postId = computed<string>(() => boostStore.target?.postId ?? '')
const preview = computed<string>(() => boostStore.target?.preview ?? '')
const language = computed<string>(() => boostStore.target?.language ?? '')
/** Название языка поста: прогноз считаем только для языков лент приложения. */
const languageName = computed<string>(() =>
  (SUPPORTED_LOCALES as readonly string[]).includes(language.value)
    ? LOCALE_NAMES[language.value as Locale]
    : ''
)
const minLabel = formatPkoinAmount(BOOST_MIN_PKOIN)

const numericAmount = computed<number>(() => Number(amount.value))

/** Монет не хватает на сумму вместе с комиссией сети. */
const insufficient = computed<boolean>(
  () =>
    balance.value !== null &&
    numericAmount.value >= BOOST_MIN_PKOIN &&
    numericAmount.value + DEFAULT_TX_FEE > balance.value
)

const validationError = computed<string | null>(() => {
  if (!amount.value) return null
  const n = numericAmount.value
  if (!Number.isFinite(n) || n <= 0) return t('boost.errAmount')
  if (n < BOOST_MIN_PKOIN) return t('boost.errMin', { min: minLabel })
  if (insufficient.value) return t('boost.errInsufficient')
  return null
})

const canSend = computed<boolean>(
  () =>
    !sending.value &&
    !!postId.value &&
    numericAmount.value >= BOOST_MIN_PKOIN &&
    !validationError.value
)

/** Сколько у поста уже набрано бустов за сутки, PKOIN. */
const currentBoost = computed<number>(() =>
  standings.value ? fromSatoshis(boostShares(standings.value, postId.value).own) : 0
)

/** Вероятность с учётом введённой суммы; `null` — посчитать нельзя. */
const forecast = computed<number | null>(() => {
  if (!languageName.value || !standings.value) return null
  const add = validationError.value ? 0 : numericAmount.value || 0
  return boostProbability(standings.value, postId.value, add)
})

/** Сколько нужно для 100 %, но не меньше минимума; 0 — уже 100 %. */
const fullAmount = computed<number>(() => {
  if (!standings.value) return 0
  const needed = boostAmountFor(standings.value, postId.value, 1)
  return needed > 0 ? Math.max(needed, BOOST_MIN_PKOIN) : 0
})

function formatPercent(value: number): string {
  return new Intl.NumberFormat(bcp47(String(locale.value)), {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value)
}

async function loadBalance(): Promise<void> {
  balance.value = null
  const address = authStore.getUserAddress
  if (!address) return
  try {
    let unspents = await getUnspents(address, 1, 9999999)
    unspents = filterAvailableUnspents(unspents, false)
    balance.value = unspents.reduce((sum, u) => sum + (u.amount || 0), 0)
  } catch (e) {
    console.warn('[Boost] balance load failed', e)
  }
}

async function loadStandings(): Promise<void> {
  standings.value = null
  if (!languageName.value) return
  standingsLoading.value = true
  const forPost = postId.value
  try {
    const boosts = await fetchBoostFeed(language.value)
    // Окно уже открыли для другого поста — этот ответ не нужен.
    if (forPost !== postId.value) return
    standings.value = boosts
      .filter((b): b is { txid: string; boost: number } => !!b.txid && Number.isFinite(b.boost))
      .map((b) => ({ txid: b.txid, boost: b.boost }))
  } catch (e) {
    console.warn('[Boost] boost feed load failed', e)
  } finally {
    if (forPost === postId.value) standingsLoading.value = false
  }
}

watch(
  () => boostStore.isOpen,
  (isOpen) => {
    if (!isOpen) return
    amount.value = ''
    void loadBalance()
    void loadStandings()
  }
)

function handleCancel(): void {
  if (sending.value) return
  boostStore.close()
}

let sound: HTMLAudioElement | null = null
function playSound(): void {
  try {
    sound ??= new Audio(donateSound)
    sound.volume = 0.5
    sound.currentTime = 0
    void sound.play().catch(() => {})
  } catch {
    // Автоплей мог быть заблокирован — не критично.
  }
}

async function onSend(): Promise<void> {
  if (!canSend.value) return
  sending.value = true
  try {
    const { boostPost } = await import('@/blockchain/core/actions/boost-action')
    await boostPost(postId.value, numericAmount.value, preview.value || undefined)
    appToast.success({ message: t('boost.sentToast') })
    playSound()
    boostStore.close()
    if (typeof window !== 'undefined') {
      effectsStore.triggerCoins(window.innerWidth / 2, window.innerHeight / 3)
    }
  } catch (e) {
    appToast.error({ message: e instanceof Error ? e.message : t('boost.errFailed') })
  } finally {
    sending.value = false
  }
}
</script>
