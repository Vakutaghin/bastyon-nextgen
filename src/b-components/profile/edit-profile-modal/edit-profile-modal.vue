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
          <Select
            id="edit-profile-language"
            v-model:value="language"
            :options="LANGUAGES"
            :disabled="saving"
          />
        </SC_Field>

        <SC_Field>
          <SC_Label for="edit-profile-address">{{ t('editProfile.donationAddresses') }}</SC_Label>
          <SC_Hint>{{ t('editProfile.donationAddressesHint') }}</SC_Hint>
          <SC_AddressList v-if="addresses.length">
            <SC_AddressRow
              v-for="(entry, index) in addresses"
              :key="entry.currency + entry.address"
            >
              <SC_AddressCurrency>{{ donationCurrencyLabel(entry.currency) }}</SC_AddressCurrency>
              <SC_AddressValue>{{ entry.address }}</SC_AddressValue>
              <SC_SmallBtn
                type="button"
                class="danger"
                :disabled="saving"
                :aria-label="t('editProfile.removeAddress')"
                :title="t('editProfile.removeAddress')"
                @click="removeAddress(index)"
              >
                <DeleteOutlined />
              </SC_SmallBtn>
            </SC_AddressRow>
          </SC_AddressList>
          <SC_AddressAdd>
            <Select
              v-model:value="newCurrency"
              :options="DONATION_CURRENCIES"
              :disabled="saving"
              :aria-label="t('editProfile.currency')"
            />
            <SC_Input
              id="edit-profile-address"
              v-model="newAddress"
              :placeholder="t('editProfile.addressPlaceholder')"
              :disabled="saving"
              autocomplete="off"
              spellcheck="false"
              @keydown.enter.prevent="addAddress"
            />
            <SC_SmallBtn type="button" :disabled="saving || !newAddress.trim()" @click="addAddress">
              {{ t('editProfile.addAddress') }}
            </SC_SmallBtn>
          </SC_AddressAdd>
          <SC_FieldError v-if="addressError" role="alert">{{ addressError }}</SC_FieldError>
        </SC_Field>
      </SC_Form>
    </SC_ModalBody>

    <template #footer>
      <SC_ModalActions>
        <Button type="default" :disabled="saving" @click="handleCancel">
          {{ t('editProfile.cancel') }}
        </Button>
        <Button type="primary" :loading="saving" :disabled="!hasChanges" @click="onSave">
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
import { DeleteOutlined } from '@/components/icons'
import { appToast } from '@/b-components/app-toast'
import { useProfileStore } from '@/blockchain/store/profile-store'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { holdProfileEdit } from '@/blockchain/store/pending-profile-edit'
import { resizeImageBase64, fileToBase64 } from '@/helpers/common/resize-image'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import { safeDecode } from '@/helpers/content/safe-decode'
import { NICKNAME_MAX_LENGTH, validateProfileNickname } from '@/helpers/profile/nickname-validation'
import { isNicknameTaken } from '@/helpers/profile/nickname-owner'
import {
  DONATION_CURRENCIES,
  donationCurrencyLabel,
  isValidDonationAddress,
  parseDonationAddresses,
  type DonationAddress,
} from '@/helpers/profile/donation-addresses'
import { SC_ModalBody, SC_ModalActions } from '@/components/modal'
import Select from '@/components/select'
import { LOCALE_NAMES, SUPPORTED_LOCALES } from '@/i18n'
import {
  SC_Form,
  SC_Field,
  SC_Label,
  SC_Input,
  SC_Textarea,
  SC_AvatarRow,
  SC_AvatarPreview,
  SC_AvatarPlaceholder,
  SC_AvatarActions,
  SC_SmallBtn,
  SC_HiddenFileInput,
  SC_Hint,
  SC_FieldError,
  SC_AddressList,
  SC_AddressRow,
  SC_AddressCurrency,
  SC_AddressValue,
  SC_AddressAdd,
} from './styled'

/** Максимум имени — как в legacy (NICKNAME, 20 символов). */
const NAME_MAX = NICKNAME_MAX_LENGTH

/**
 * Языки контента (поле `l` профиля) — те же, что у постов: по `l` нода
 * подбирает аккаунт в «Кого читать» читателям этого языка, а ленты сети
 * бывают только на языках интерфейса. Раньше здесь были португальский,
 * японский и другие языки без своих лент, но не было сербского и корейского.
 */
const LANGUAGES = SUPPORTED_LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value] }))

const props = defineProps<{ open: boolean; profile?: UserProfile | null }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'updated', patch: Partial<UserProfile>): void
}>()

const { t, locale } = useI18n()

const name = ref('')
const about = ref('')
const site = ref('')
const language = ref('')
/** Текущее изображение: URL существующего аватара или data-URI только что выбранного. */
const avatarPreview = ref('')
/** Пользователь сменил/удалил аватар (нужна загрузка/сброс при сохранении). */
const avatarChanged = ref(false)
const saving = ref(false)
const uploadingAvatar = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
/** Адреса для пожертвований (поле `b`). */
const addresses = ref<DonationAddress[]>([])
const newCurrency = ref<string>(DONATION_CURRENCIES[0]!.value)
const newAddress = ref('')
const addressError = ref('')

const avatarInitial = computed<string>(() => (name.value.trim()[0] || '?').toUpperCase())

/** Профиль, которым заполнена форма: правки считаются от него. */
const filledFrom = ref<UserProfile | null>(null)

/** Заполняет форму из профиля при каждом открытии. */
function resetFromProfile(): void {
  const p = props.profile
  filledFrom.value = p ?? null
  name.value = p?.name || ''
  // Только `a`: `r` — адрес реферера, его нельзя подставлять в «О себе» (S54).
  // Старые записи бывают URL-кодированы — в поле показываем текст, как в профиле.
  about.value = safeDecode(p?.a || '')
  site.value = p?.s || ''
  language.value = p?.l || String(locale.value)
  avatarPreview.value = p?.i || ''
  avatarChanged.value = false
  addresses.value = parseDonationAddresses(p?.b)
  newAddress.value = ''
  addressError.value = ''
}

/**
 * Есть что сохранять. Без правок старый клиент отвечал «изменений нет» и
 * транзакцию не слал — здесь кнопка просто неактивна.
 */
const hasChanges = computed<boolean>(() => {
  const p = filledFrom.value
  if (!p) return true
  return (
    avatarChanged.value ||
    name.value.trim() !== (p.name || '') ||
    about.value.trim() !== safeDecode(p.a || '').trim() ||
    site.value.trim() !== (p.s || '').trim() ||
    language.value !== (p.l || String(locale.value)) ||
    JSON.stringify(addresses.value) !== JSON.stringify(parseDonationAddresses(p.b))
  )
})

function addAddress(): void {
  const address = newAddress.value.trim()
  if (!address) return
  if (!isValidDonationAddress(newCurrency.value, address)) {
    addressError.value = t('editProfile.errAddressInvalid', {
      currency: donationCurrencyLabel(newCurrency.value),
    })
    return
  }
  if (addresses.value.some((a) => a.currency === newCurrency.value && a.address === address)) {
    addressError.value = t('editProfile.errAddressDuplicate')
    return
  }
  addresses.value = [...addresses.value, { currency: newCurrency.value, address }]
  newAddress.value = ''
  addressError.value = ''
}

function removeAddress(index: number): void {
  addresses.value = addresses.value.filter((_, i) => i !== index)
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) resetFromProfile()
  },
  { immediate: true }
)

// Профиль догрузился, пока окно открыто: форму без правок заполняем заново.
// Раньше в полях оставались прежние данные, а сравнивались они уже с новыми —
// и «Сохранить» горела без единой правки.
watch(
  () => props.profile,
  () => {
    if (!props.open) return
    const untouched = filledFrom.value
      ? !hasChanges.value
      : !name.value && !about.value && !site.value && !addresses.value.length
    if (untouched) resetFromProfile()
  }
)

function triggerFilePicker(): void {
  fileInputRef.value?.click()
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Сбрасываем, чтобы повторный выбор того же файла снова триггерил change.
  input.value = ''
  if (!file) return
  // Тип бывает пустым (файл из облака на Android) — тогда решает сама картинка.
  // Не картинка или формат, который WebView не открывает (HEIC с камеры), —
  // говорим об этом, а не молчим.
  if (file.type && !file.type.startsWith('image/')) {
    appToast.error({ message: t('editProfile.errAvatarFormat') })
    return
  }
  let base64: string
  try {
    base64 = await fileToBase64(file)
    // Без типа FileReader пишет application/octet-stream; формат декодер узнаёт сам.
    if (!file.type) base64 = base64.replace(/^data:[^;,]*/, 'data:image/jpeg')
  } catch (e) {
    console.error('[EditProfile] avatar read failed', e)
    appToast.error({ message: t('editProfile.errAvatarUpload') })
    return
  }
  try {
    avatarPreview.value = await resizeImageBase64(base64, {
      maxWidth: 200,
      maxHeight: 200,
      quality: 0.9,
    })
    avatarChanged.value = true
  } catch (e) {
    console.error('[EditProfile] avatar decode failed', file.type || 'no type', e)
    appToast.error({ message: t('editProfile.errAvatarFormat') })
  }
}

function removeAvatar(): void {
  avatarPreview.value = ''
  avatarChanged.value = true
}

function handleCancel(): void {
  if (saving.value) return
  emit('close')
}

async function onSave(): Promise<void> {
  const trimmedName = name.value.trim()
  const nameError = validateProfileNickname(trimmedName, props.profile?.name)
  if (nameError) {
    appToast.error({ message: nameError })
    return
  }

  saving.value = true
  try {
    // Новое имя может быть занято: спросим ноду до транзакции, как старый
    // клиент. Сеть недоступна — не мешаем, занятое имя отвергнет сама нода.
    if (trimmedName !== props.profile?.name) {
      const taken = await isNicknameTaken(
        trimmedName,
        useAuthStore().getUserAddress ?? props.profile?.address
      ).catch(() => false)
      if (taken) {
        appToast.error({ message: t('editProfile.errNameTaken') })
        return
      }
    }

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
    const txid = await updateUserProfileInfo({
      name: trimmedName,
      about: about.value.trim(),
      site: site.value.trim(),
      language: language.value,
      image,
      addresses: addresses.value,
    })

    // 3. Оптимистично обновляем закэшированный профиль (хедер/сайдбар) и страницу.
    const patch: Partial<UserProfile> = {
      name: trimmedName,
      a: about.value.trim(),
      s: site.value.trim(),
      l: language.value,
      i: image,
      b: JSON.stringify(addresses.value),
    }
    // До блока нода отдаёт прежний профиль: правка держится поверх него.
    const address = useAuthStore().getUserAddress ?? props.profile?.address
    if (address) holdProfileEdit(address, txid, patch)
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
