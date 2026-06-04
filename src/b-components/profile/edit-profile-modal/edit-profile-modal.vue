<template>
  <Modal
    :open="open"
    :width="480"
    :centered="true"
    :closable="!saving"
    :mask-closable="!saving"
    :z-index="2700"
    :title="t('editProfile.title')"
    @cancel="handleCancel"
  >
    <SC_ModalBody>
      <SC_Form>
        <SC_Field>
          <SC_Label>{{ t('editProfile.avatar') }}</SC_Label>
          <SC_AvatarRow>
            <SC_AvatarPreview v-if="avatarPreview" :src="avatarPreview" :alt="name" />
            <SC_AvatarPlaceholder v-else>{{ avatarInitial }}</SC_AvatarPlaceholder>

            <SC_AvatarActions>
              <SC_SmallBtn type="button" :disabled="saving" @click="triggerFilePicker">
                {{ t('editProfile.changeAvatar') }}
              </SC_SmallBtn>
              <SC_SmallBtn
                v-if="avatarPreview"
                type="button"
                class="danger"
                :disabled="saving"
                @click="removeAvatar"
              >
                {{ t('editProfile.removeAvatar') }}
              </SC_SmallBtn>
            </SC_AvatarActions>

            <SC_HiddenFileInput
              ref="fileInputRef"
              type="file"
              accept="image/*"
              @change="onFileChange"
            />
          </SC_AvatarRow>
        </SC_Field>

        <SC_Field>
          <SC_Label for="edit-profile-name">{{ t('editProfile.name') }}</SC_Label>
          <SC_Input
            id="edit-profile-name"
            v-model="name"
            :maxlength="NAME_MAX"
            :placeholder="t('editProfile.namePlaceholder')"
            :disabled="saving"
          />
        </SC_Field>

        <SC_Field>
          <SC_Label for="edit-profile-about">{{ t('editProfile.about') }}</SC_Label>
          <SC_Textarea
            id="edit-profile-about"
            v-model="about"
            :placeholder="t('editProfile.aboutPlaceholder')"
            :disabled="saving"
          />
        </SC_Field>

        <SC_Field>
          <SC_Label for="edit-profile-site">{{ t('editProfile.site') }}</SC_Label>
          <SC_Input
            id="edit-profile-site"
            v-model="site"
            :placeholder="t('editProfile.sitePlaceholder')"
            :disabled="saving"
          />
        </SC_Field>

        <SC_Field>
          <SC_Label for="edit-profile-language">{{ t('editProfile.language') }}</SC_Label>
          <SC_Select id="edit-profile-language" v-model="language" :disabled="saving">
            <option v-for="lang in LANGUAGES" :key="lang.value" :value="lang.value">
              {{ lang.label }}
            </option>
          </SC_Select>
        </SC_Field>
      </SC_Form>
    </SC_ModalBody>

    <template #footer>
      <SC_ModalActions>
        <Button type="default" :disabled="saving" @click="handleCancel">
          {{ t('editProfile.cancel') }}
        </Button>
        <Button type="primary" :loading="saving" @click="onSave">
          {{ saving && uploadingAvatar ? t('editProfile.uploadingAvatar') : t('editProfile.save') }}
        </Button>
      </SC_ModalActions>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal, Button } from 'ant-design-vue'
import { appToast } from '@/b-components/app-toast'
import { useProfileStore } from '@/blockchain/store/profile-store'
import { resizeImageBase64, fileToBase64 } from '@/helpers/common/resize-image'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import { SC_ModalBody, SC_ModalActions } from '@/components/modal'
import {
  SC_Form,
  SC_Field,
  SC_Label,
  SC_Input,
  SC_Textarea,
  SC_Select,
  SC_AvatarRow,
  SC_AvatarPreview,
  SC_AvatarPlaceholder,
  SC_AvatarActions,
  SC_SmallBtn,
  SC_HiddenFileInput,
} from './styled'

/** Максимум имени — как в legacy (NICKNAME, 20 символов). */
const NAME_MAX = 20

/** Языки контента (value — ISO-код для поля `l` профиля). */
const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
  { value: 'es', label: 'Español' },
  { value: 'pt', label: 'Português' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'uk', label: 'Українська' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ar', label: 'العربية' },
]

const props = defineProps<{ open: boolean; profile?: UserProfile | null }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'updated', patch: Partial<UserProfile>): void
}>()

const { t } = useI18n()

const name = ref('')
const about = ref('')
const site = ref('')
const language = ref('en')
/** Текущее изображение: URL существующего аватара или data-URI только что выбранного. */
const avatarPreview = ref('')
/** Пользователь сменил/удалил аватар (нужна загрузка/сброс при сохранении). */
const avatarChanged = ref(false)
const saving = ref(false)
const uploadingAvatar = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const avatarInitial = computed<string>(() => (name.value.trim()[0] || '?').toUpperCase())

/** Заполняет форму из профиля при каждом открытии. */
function resetFromProfile(): void {
  const p = props.profile
  name.value = p?.name || ''
  about.value = p?.a || p?.r || ''
  site.value = p?.s || ''
  language.value = p?.l || 'en'
  avatarPreview.value = p?.i || ''
  avatarChanged.value = false
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) resetFromProfile()
  },
  { immediate: true }
)

function triggerFilePicker(): void {
  fileInputRef.value?.click()
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Сбрасываем, чтобы повторный выбор того же файла снова триггерил change.
  input.value = ''
  if (!file || !file.type.startsWith('image/')) return
  try {
    const base64 = await fileToBase64(file)
    avatarPreview.value = await resizeImageBase64(base64, {
      maxWidth: 200,
      maxHeight: 200,
      quality: 0.9,
    })
    avatarChanged.value = true
  } catch (e) {
    console.error('[EditProfile] avatar read failed', e)
    appToast.error({ message: t('editProfile.errAvatarUpload') })
  }
}

function removeAvatar(): void {
  avatarPreview.value = ''
  avatarChanged.value = true
}

/** Сохранённые крипто-адреса (поле `b`) — переносим без изменений. */
function extractAddresses(): unknown[] {
  const b = props.profile?.b
  if (!b) return []
  try {
    const parsed = JSON.parse(b)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function handleCancel(): void {
  if (saving.value) return
  emit('close')
}

async function onSave(): Promise<void> {
  const trimmedName = name.value.trim()
  if (!trimmedName) {
    appToast.error({ message: t('editProfile.errNameRequired') })
    return
  }
  if (trimmedName.length > NAME_MAX) {
    appToast.error({ message: t('editProfile.nameTooLong', { max: NAME_MAX }) })
    return
  }

  saving.value = true
  try {
    // 1. Аватар: грузим новый data-URI на хостинг; пустой — снятие аватара.
    let image = props.profile?.i || ''
    if (avatarChanged.value) {
      if (avatarPreview.value.startsWith('data:')) {
        uploadingAvatar.value = true
        try {
          const { uploadImage } = await import('@/services/image-upload-service')
          image = await uploadImage(avatarPreview.value)
        } catch (e) {
          console.error('[EditProfile] avatar upload failed', e)
          appToast.error({ message: t('editProfile.errAvatarUpload') })
          return
        } finally {
          uploadingAvatar.value = false
        }
      } else {
        image = ''
      }
    }

    // 2. Отправляем userInfo-транзакцию.
    const { updateUserProfileInfo } =
      await import('@/blockchain/core/actions/profile-update-action')
    await updateUserProfileInfo({
      name: trimmedName,
      about: about.value.trim(),
      site: site.value.trim(),
      language: language.value,
      image,
      addresses: extractAddresses(),
    })

    // 3. Оптимистично обновляем закэшированный профиль (хедер/сайдбар) и страницу.
    const patch: Partial<UserProfile> = {
      name: trimmedName,
      a: about.value.trim(),
      s: site.value.trim(),
      l: language.value,
      i: image,
    }
    useProfileStore().patchUserProfile(patch)
    emit('updated', patch)
    appToast.success({ message: t('editProfile.savedToast') })
    emit('close')
  } catch (e) {
    appToast.error({ message: e instanceof Error ? e.message : t('editProfile.errFailed') })
  } finally {
    saving.value = false
  }
}
</script>
