<template>
  <!-- Одно окно на приложение: скачивание модели распознавания и ошибки. -->
  <Modal
    :open="store.modalOpen"
    :title="t('voiceInput.modal.title')"
    :footer="null"
    :width="500"
    :destroy-on-close="true"
    :z-index="2600"
    @cancel="onClose"
  >
    <SC_Wrap>
      <template v-if="store.modalPhase === 'consent'">
        <SC_Text>{{ t('voiceInput.modal.lead') }}</SC_Text>
        <SC_Note>{{ t('voiceInput.modal.download') }}</SC_Note>

        <SC_ModelList role="radiogroup" :aria-label="t('voiceInput.settings.model')">
          <SC_ModelOption v-for="m in models" :key="m.id" :class="{ selected: choice === m.id }">
            <input
              type="radio"
              name="voice-model"
              :value="m.id"
              :checked="choice === m.id"
              @change="choice = m.id"
            />
            <SC_ModelName>
              {{ t(`voiceInput.models.${m.id}`) }}
              <SC_Badge v-if="m.id === DEFAULT_VOICE_MODEL">
                {{ t('voiceInput.modal.recommended') }}
              </SC_Badge>
            </SC_ModelName>
            <SC_ModelSize>{{ formatFileSize(m.size) }}</SC_ModelSize>
            <SC_ModelHint>{{ modelHint(m.id) }}</SC_ModelHint>
          </SC_ModelOption>
        </SC_ModelList>

        <SC_Note>{{ t('voiceInput.modal.commands') }}</SC_Note>
        <SC_Note v-if="viaTor">{{ t('voiceInput.modal.viaTor') }}</SC_Note>

        <SC_Footer>
          <SC_GhostButton type="button" @click="onClose">
            {{ t('voiceInput.modal.cancel') }}
          </SC_GhostButton>
          <SC_PrimaryButton type="button" @click="onDownload">
            {{ t('voiceInput.modal.downloadButton', { size: formatFileSize(choiceSize) }) }}
          </SC_PrimaryButton>
        </SC_Footer>
      </template>

      <template v-else-if="store.modalPhase === 'progress'">
        <SC_Text>
          {{ t('voiceInput.modal.downloading', { name: modelName(store.install?.model) }) }}
        </SC_Text>
        <SC_Progress :value="store.installPercent" max="100" />
        <SC_Note>
          {{
            t('voiceInput.modal.progress', {
              received: formatFileSize(store.install?.received ?? 0),
              total: formatFileSize(store.install?.total ?? 0),
            })
          }}
        </SC_Note>
        <SC_Footer>
          <SC_GhostButton type="button" @click="store.cancelInstall()">
            {{ t('voiceInput.modal.cancelDownload') }}
          </SC_GhostButton>
          <SC_PrimaryButton type="button" @click="onClose">
            {{ t('voiceInput.modal.hide') }}
          </SC_PrimaryButton>
        </SC_Footer>
      </template>

      <template v-else-if="store.modalPhase === 'error'">
        <SC_Text>{{ voiceErrorText(store.modalError) }}</SC_Text>
        <SC_Footer>
          <SC_GhostButton type="button" @click="onClose">
            {{ t('voiceInput.modal.close') }}
          </SC_GhostButton>
          <SC_PrimaryButton type="button" @click="onRetry">
            {{ t('voiceInput.modal.retry') }}
          </SC_PrimaryButton>
        </SC_Footer>
      </template>

      <template v-else>
        <SC_Text>{{ t('voiceInput.errors.unsupportedCpu') }}</SC_Text>
        <SC_Footer>
          <SC_PrimaryButton type="button" @click="onClose">
            {{ t('voiceInput.modal.ok') }}
          </SC_PrimaryButton>
        </SC_Footer>
      </template>
    </SC_Wrap>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal } from 'ant-design-vue'

import { formatFileSize } from '@/b-components/video-uploader/utils/video-formatter'
import { useTorStore } from '@/stores/tor-store'
import {
  DEFAULT_VOICE_MODEL,
  useVoiceInputStore,
  voiceErrorText,
  type VoiceModelId,
} from '@/stores/voice-input-store'
import {
  SC_Badge,
  SC_Footer,
  SC_GhostButton,
  SC_ModelHint,
  SC_ModelList,
  SC_ModelName,
  SC_ModelOption,
  SC_ModelSize,
  SC_Note,
  SC_PrimaryButton,
  SC_Progress,
  SC_Text,
  SC_Wrap,
} from './voice-model-modal.styled'

const { t } = useI18n()
const store = useVoiceInputStore()
const tor = useTorStore()

const choice = ref<VoiceModelId>(store.model)
watch(
  () => store.modalOpen,
  (open) => {
    if (open) choice.value = store.model
  }
)

const models = computed(() => store.status?.models ?? [])
const choiceSize = computed(() => models.value.find((m) => m.id === choice.value)?.size ?? 0)
const viaTor = computed(() => tor.shouldTorify)

function modelName(id: VoiceModelId | undefined): string {
  return id ? t(`voiceInput.models.${id}`) : ''
}

function modelHint(id: VoiceModelId): string {
  // Самой большой модели нужна видеокарта Apple: без неё она заметно медленнее.
  if (id === 'turbo' && !store.status?.gpu) return t('voiceInput.models.turboHintCpu')
  return t(`voiceInput.models.${id}Hint`)
}

function onDownload(): void {
  void store.installModel(choice.value)
}

function onRetry(): void {
  void store.installModel(store.model)
}

function onClose(): void {
  store.closeModal()
}
</script>
