<template>
  <!-- Как «Дневные лимиты загрузки» в видеокабинете прежнего приложения:
       сколько ещё можно загрузить сегодня, от чего лимит растёт и какие файлы
       видеосервер принимает. -->
  <Modal
    :open="true"
    :title="t('mediaStudio.limits.title')"
    :footer="null"
    :width="520"
    :z-index="1100"
    @cancel="emit('close')"
  >
    <SC_Body data-testid="upload-limits">
      <SC_Section>
        <SC_SectionTitle>{{ t('mediaStudio.limits.today') }}</SC_SectionTitle>
        <SC_Muted v-if="!signedIn">{{ t('mediaStudio.limits.signIn') }}</SC_Muted>
        <Spin v-else-if="limits.loading.value && !limits.quota.value" size="small" />
        <template v-else-if="limits.quota.value">
          <SC_QuotaValue v-if="limits.unlimited.value">
            {{ t('mediaStudio.limits.unlimited') }}
          </SC_QuotaValue>
          <template v-else>
            <SC_QuotaValue>
              {{
                t('mediaStudio.limits.left', {
                  left: formatQuota(limits.remaining.value),
                  total: formatQuota(limits.quota.value.daily),
                })
              }}
            </SC_QuotaValue>
            <Progress
              :percent="limits.usedPercent.value"
              :show-info="false"
              stroke-color="var(--ui-primary)"
            />
          </template>
          <SC_Muted>{{ t('mediaStudio.limits.window') }}</SC_Muted>
        </template>
        <SC_Muted v-else-if="limits.quotaFailed.value" class="error" role="alert">
          {{ t('mediaStudio.limits.failed') }}
          <Button type="link" size="small" @click="limits.load">
            {{ t('mediaStudio.limits.retry') }}
          </Button>
        </SC_Muted>
      </SC_Section>

      <SC_Section>
        <SC_SectionTitle>{{ t('mediaStudio.limits.tiersTitle') }}</SC_SectionTitle>
        <SC_Tiers>
          <li
            v-for="tier in UPLOAD_QUOTA_TIERS"
            :key="tier.id"
            :class="{ current: tier.id === limits.tier.value }"
          >
            <SC_TierSize>{{ formatQuota(tier.bytes) }}</SC_TierSize>
            <SC_TierText>{{ t(`mediaStudio.limits.tier.${tier.id}`) }}</SC_TierText>
            <SC_TierBadge v-if="tier.id === limits.tier.value">
              {{ t('mediaStudio.limits.yours') }}
            </SC_TierBadge>
          </li>
        </SC_Tiers>
        <SC_Muted>{{ t('mediaStudio.limits.tiersNote') }}</SC_Muted>
      </SC_Section>

      <SC_Section>
        <SC_SectionTitle>{{ t('mediaStudio.limits.filesTitle') }}</SC_SectionTitle>
        <SC_Rules>
          <li>{{ t('mediaStudio.limits.maxSize', { max: formatSize(MAX_VIDEO_SIZE_BYTES) }) }}</li>
          <li>{{ t('mediaStudio.limits.videoFormats', { list: limits.videoFormats.value }) }}</li>
          <li>{{ t('mediaStudio.limits.audioFormats', { list: limits.audioFormats.value }) }}</li>
          <li v-if="limits.maxResolution.value">
            {{ t('mediaStudio.limits.quality', { resolution: limits.maxResolution.value }) }}
          </li>
          <li v-if="desktop">
            {{ t('mediaStudio.limits.compress', { option: t('videoStudio.compress') }) }}
          </li>
        </SC_Rules>
      </SC_Section>

      <SC_Footnote>
        <span>{{ t('mediaStudio.limits.posts', { page: t('limits.title') }) }}</span>
        <Button v-if="signedIn" type="link" @click="openLimitsPage">
          {{ t('mediaStudio.limits.postsLink') }}
        </Button>
      </SC_Footnote>
      <SC_Muted v-if="limits.host.value">
        {{ t('mediaStudio.limits.server', { host: limits.host.value }) }}
      </SC_Muted>
    </SC_Body>
  </Modal>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Button, Modal, Progress, Spin } from 'ant-design-vue'

import { useAuthStore } from '@/blockchain/store/auth-store'
import { isTauri } from '@/b-components/video-uploader/utils/environment'
import { UPLOAD_QUOTA_TIERS } from '@/services/peertube/peertube-upload-limits'
import { MAX_VIDEO_SIZE_BYTES } from '@/services/peertube/peertube-validation'
import { formatQuota, formatSize } from './studio-format'
import { useUploadLimits } from './use-upload-limits'
import { useVideoServerToken } from './video-server-token'
import {
  SC_Body,
  SC_Section,
  SC_SectionTitle,
  SC_QuotaValue,
  SC_Muted,
  SC_Tiers,
  SC_TierSize,
  SC_TierText,
  SC_TierBadge,
  SC_Rules,
  SC_Footnote,
} from './upload-limits-modal.styled'

const emit = defineEmits<{ (e: 'close'): void }>()

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const signedIn = authStore.isUserAuthenticated
const desktop = isTauri()
const limits = useUploadLimits({ deps: { token: signedIn ? useVideoServerToken() : null } })

onMounted(() => void limits.load())

function openLimitsPage(): void {
  emit('close')
  void router.push({ name: 'limits' })
}
</script>
