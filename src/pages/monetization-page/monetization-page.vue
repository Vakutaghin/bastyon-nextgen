<template>
  <SC_MonetizationWork>
    <SC_MonetizationPage>
      <SC_Hero>
        <SC_HeroIcon aria-hidden="true"><DollarOutlined /></SC_HeroIcon>
        <SC_HeroBody>
          <SC_Title>{{ t('monetization.title') }}</SC_Title>
          <SC_Lead>{{ t('monetization.lead') }}</SC_Lead>
          <SC_HeroActions>
            <Button type="primary" data-testid="monetization-help" @click="openHelp">
              <template #icon><QuestionCircleOutlined /></template>
              {{ t('monetization.moreInHelp') }}
            </Button>
          </SC_HeroActions>
        </SC_HeroBody>
      </SC_Hero>

      <SC_Section>
        <SC_SectionTitle>{{ t('monetization.flowTitle') }}</SC_SectionTitle>
        <MonetizationFlow />
      </SC_Section>

      <SC_Cards>
        <SC_Card>
          <SC_CardHead>
            <SC_CardIcon class="verified" aria-hidden="true"
              ><SafetyCertificateOutlined
            /></SC_CardIcon>
            {{ t('monetization.whoTitle') }}
          </SC_CardHead>
          <SC_CardText>{{ t('monetization.whoText') }}</SC_CardText>
          <SC_CardFooter>
            <span>{{ t('monetization.whoAction') }}</span>
            <SC_MailButton type="button" data-testid="monetization-mail" @click="writeToTeam">
              {{ SUPPORT_EMAIL }}
            </SC_MailButton>
            <Button
              type="text"
              size="small"
              data-testid="monetization-copy-email"
              :aria-label="t('monetization.copyEmail')"
              :title="t('monetization.copyEmail')"
              @click="copyEmail"
            >
              <template #icon><CopyOutlined /></template>
            </Button>
          </SC_CardFooter>
        </SC_Card>

        <SC_Card>
          <SC_CardHead>
            <SC_CardIcon aria-hidden="true"><CalendarOutlined /></SC_CardIcon>
            {{ t('monetization.whenTitle') }}
          </SC_CardHead>
          <SC_CardText>{{ t('monetization.whenText') }}</SC_CardText>
          <!-- Кошелёк — только для вошедших: гостю ссылка открыла бы окно входа. -->
          <SC_CardFooter v-if="authStore.isUserAuthenticated">
            <SC_InlineLink
              :to="{ name: 'wallets', query: { tab: 'history' } }"
              data-testid="monetization-history"
              >{{ t('monetization.whenLink') }} →</SC_InlineLink
            >
          </SC_CardFooter>
        </SC_Card>

        <SC_Card>
          <SC_CardHead>
            <SC_CardIcon aria-hidden="true"><SwapOutlined /></SC_CardIcon>
            {{ t('monetization.withdrawTitle') }}
          </SC_CardHead>
          <SC_CardText>{{ t('monetization.withdrawText') }}</SC_CardText>
          <SC_CardFooter>
            <HelpLink topic="how-to-buy-pkoin" :label="t('monetization.withdrawLink')" />
          </SC_CardFooter>
        </SC_Card>

        <SC_Card>
          <SC_CardHead>
            <SC_CardIcon aria-hidden="true"><RiseOutlined /></SC_CardIcon>
            {{ t('monetization.growTitle') }}
          </SC_CardHead>
          <SC_CardList>
            <li>{{ t('monetization.growMore') }}</li>
            <li>{{ t('monetization.growPeople') }}</li>
            <li>{{ t('monetization.growVideo') }}</li>
          </SC_CardList>
        </SC_Card>
      </SC_Cards>
    </SC_MonetizationPage>
  </SC_MonetizationWork>
</template>

<script setup lang="ts">
// «Монетизация для авторов»: наглядный пересказ страницы /monetization прежнего
// приложения — схема круга денег и четыре карточки. Подробности (кто
// участвует, как считают, чего здесь нет) — в статье справки monetization.
// Страница открыта и без входа: о программе читают и будущие авторы.
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/blockchain'
import { appToast } from '@/b-components/app-toast'
import HelpLink from '@/b-components/help/help-link.vue'
import { Button } from '@/components'
import {
  CalendarOutlined,
  CopyOutlined,
  DollarOutlined,
  QuestionCircleOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
} from '@/components/icons'
import { copyText } from '@/helpers/common/clipboard'
import { openExternal } from '@/helpers/common/open-external'
import { useHelpStore } from '@/stores/help-store'
import MonetizationFlow from './monetization-flow.vue'
import {
  SC_Card,
  SC_CardFooter,
  SC_CardHead,
  SC_CardIcon,
  SC_CardList,
  SC_Cards,
  SC_CardText,
  SC_Hero,
  SC_HeroActions,
  SC_HeroBody,
  SC_HeroIcon,
  SC_InlineLink,
  SC_Lead,
  SC_MailButton,
  SC_MonetizationPage,
  SC_MonetizationWork,
  SC_Section,
  SC_SectionTitle,
  SC_Title,
} from './monetization-page.styled'

/** Почта команды Bastyon: монетизацию подключают по письму туда (так и в прежнем приложении). */
const SUPPORT_EMAIL = 'support@bastyon.com'

const { t } = useI18n()
const authStore = useAuthStore()
const help = useHelpStore()

function openHelp(): void {
  help.openTopic('monetization')
}

function writeToTeam(): void {
  void openExternal(`mailto:${SUPPORT_EMAIL}`)
}

async function copyEmail(): Promise<void> {
  if (await copyText(SUPPORT_EMAIL)) appToast.success({ message: t('monetization.emailCopied') })
}
</script>
