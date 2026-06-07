<template>
  <SC_Overlay v-if="open" @click.self="!loading && emit('close')">
    <SC_Dialog>
      <SC_Title>{{ t('miniapps.sideloadTitle') }}</SC_Title>

      <SC_Field>
        <SC_Label>{{ t('miniapps.sideloadScopeLabel') }}</SC_Label>
        <SC_Input
          v-model="scope"
          :placeholder="t('miniapps.sideloadScopePlaceholder')"
          :disabled="loading"
          @keydown.enter="load"
        />
        <SC_Hint>{{ t('miniapps.sideloadScopeHint') }}</SC_Hint>
      </SC_Field>

      <SC_Field>
        <SC_Label>{{ t('miniapps.sideloadNameLabel') }}</SC_Label>
        <SC_Input
          v-model="displayName"
          :placeholder="t('miniapps.sideloadNamePlaceholder')"
          :disabled="loading"
          @keydown.enter="load"
        />
      </SC_Field>

      <SC_Error v-if="error">{{ error }}</SC_Error>

      <SC_Actions>
        <SC_Btn type="button" :disabled="loading" @click="emit('close')">
          {{ t('miniapps.sideloadCancel') }}
        </SC_Btn>
        <SC_Btn type="button" :primary="true" :disabled="loading || !scope.trim()" @click="load">
          {{ loading ? t('miniapps.sideloadLoading') : t('miniapps.sideloadLoad') }}
        </SC_Btn>
      </SC_Actions>
    </SC_Dialog>
  </SC_Overlay>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppsStore } from '@/mini-apps/store/apps-store'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const { t } = useI18n()
const router = useRouter()
const appsStore = useAppsStore()

const scope = ref('')
const displayName = ref('')
const loading = ref(false)
const error = ref('')

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      scope.value = ''
      displayName.value = ''
      error.value = ''
      loading.value = false
    }
  }
)

async function load(): Promise<void> {
  const s = scope.value.trim()
  if (!s || loading.value) return
  loading.value = true
  error.value = ''
  try {
    const app = await appsStore.addLocal(s, displayName.value.trim() || undefined)
    emit('close')
    void router.push(`/app/${encodeURIComponent(app.manifest.id)}`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}
</script>
