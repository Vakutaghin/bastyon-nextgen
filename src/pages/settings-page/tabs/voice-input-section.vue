<template>
  <!-- Голосовой ввод есть только в десктопе: распознавание идёт на компьютере. -->
  <SC_VoiceCard v-if="store.available">
    <SC_VoiceHead>
      <SC_VoiceTitle>{{ t('voiceInput.settings.title') }}</SC_VoiceTitle>
      <SC_VoiceStatus>{{ statusLabel }}</SC_VoiceStatus>
    </SC_VoiceHead>
    <SC_VoiceDesc>{{ t('voiceInput.settings.description') }}</SC_VoiceDesc>

    <SC_VoiceDesc v-if="store.status && !store.status.supported">
      {{ t('voiceInput.errors.unsupportedCpu') }}
    </SC_VoiceDesc>

    <SC_ModelRows v-else role="radiogroup" :aria-label="t('voiceInput.settings.model')">
      <SC_ModelRow
        v-for="m in models"
        :key="m.id"
        :class="{ selected: m.installed && store.activeModel === m.id }"
      >
        <input
          type="radio"
          name="voice-model-settings"
          :value="m.id"
          :checked="m.installed && store.activeModel === m.id"
          :disabled="!m.installed"
          :aria-label="t(`voiceInput.models.${m.id}`)"
          @change="store.setModel(m.id)"
        />
        <SC_ModelInfo>
          <SC_ModelLine>
            {{ t(`voiceInput.models.${m.id}`) }}
            <SC_ModelMeta>
              {{ formatFileSize(m.size) }}
              <template v-if="m.installed">· {{ t('voiceInput.settings.installed') }}</template>
            </SC_ModelMeta>
          </SC_ModelLine>
          <SC_ModelHint>{{ modelHint(m.id) }}</SC_ModelHint>
        </SC_ModelInfo>
        <SC_ModelActions>
          <template v-if="store.install?.model === m.id">
            <span>{{ store.installPercent }}%</span>
            <Button size="small" @click="store.cancelInstall()">
              {{ t('voiceInput.modal.cancel') }}
            </Button>
          </template>
          <Button v-else-if="m.installed" size="small" danger @click="onRemove(m.id)">
            {{ t('voiceInput.settings.remove') }}
          </Button>
          <Button v-else size="small" :disabled="!!store.install" @click="onInstall(m.id)">
            {{ t('voiceInput.settings.download') }}
          </Button>
        </SC_ModelActions>
      </SC_ModelRow>
    </SC_ModelRows>

    <SC_Commands v-if="commands.length">
      <summary>{{ t('voiceInput.settings.commandsTitle') }}</summary>
      <SC_CommandList>
        <template v-for="c in commands" :key="c.say">
          <dt>{{ c.say }}</dt>
          <dd>{{ c.put }}</dd>
        </template>
      </SC_CommandList>
    </SC_Commands>
  </SC_VoiceCard>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal } from 'ant-design-vue'

import { formatFileSize } from '@/b-components/video-uploader/utils/video-formatter'
import { spokenCommandHints } from '@/helpers/voice-input/spoken-commands'
import { useVoiceInputStore, type VoiceModelId } from '@/stores/voice-input-store'
import {
  SC_CommandList,
  SC_Commands,
  SC_ModelActions,
  SC_ModelHint,
  SC_ModelInfo,
  SC_ModelLine,
  SC_ModelMeta,
  SC_ModelRow,
  SC_ModelRows,
  SC_VoiceCard,
  SC_VoiceDesc,
  SC_VoiceHead,
  SC_VoiceStatus,
  SC_VoiceTitle,
} from './voice-input-section.styled'

const { t, locale } = useI18n()
const store = useVoiceInputStore()

onMounted(() => {
  void store.subscribe()
  void store.refresh()
})

const models = computed(() => store.status?.models ?? [])

const statusLabel = computed<string>(() => {
  const active = store.activeModel
  return active
    ? t('voiceInput.settings.statusReady', { name: t(`voiceInput.models.${active}`) })
    : t('voiceInput.settings.statusNone')
})

const commands = computed(() => spokenCommandHints(String(locale.value)))

function modelHint(id: VoiceModelId): string {
  if (id === 'turbo' && !store.status?.gpu) return t('voiceInput.models.turboHintCpu')
  return t(`voiceInput.models.${id}Hint`)
}

function onInstall(id: VoiceModelId): void {
  void store.installModel(id)
}

function onRemove(id: VoiceModelId): void {
  Modal.confirm({
    title: t('voiceInput.settings.removeTitle', { name: t(`voiceInput.models.${id}`) }),
    content: t('voiceInput.settings.removeContent'),
    okText: t('voiceInput.settings.remove'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: () => store.removeModel(id),
  })
}
</script>
