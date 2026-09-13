// Челлендж «докажите, что бэкап у вас есть» (VP-7): вместо галочки «я записал»
// просим ввести три случайных слова из 12 (или хвост приватного ключа для
// аккаунтов без мнемоники). Успех отмечается per-адрес (VP-8) и гейтит
// включение passphrase.

import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores'
import { t } from '@/i18n'
import {
  pickChallengePositions,
  verifyWordChallenge,
  verifyKeyTail,
  markBackupVerified,
  getBackupStatus,
  KEY_TAIL_CHARS,
  type BackupState,
} from '@/helpers/backup/backup-verification'
import { loadAccountSecret } from './load-account-secret'

export type ChallengeKind = 'words' | 'key'

export function useBackupVerification() {
  const authStore = useAuthStore()

  const kind = ref<ChallengeKind>('words')
  const positions = ref<number[]>([])
  const answers = ref<string[]>([])
  const loading = ref(false)
  const error = ref('')
  const status = ref<{ state: BackupState; verifiedAt: number | null }>({
    state: 'never',
    verifiedAt: null,
  })

  let secretWords: string[] = []
  let secretKey = ''

  const address = (): string => authStore.getUserAddress || ''

  const refreshStatus = (): void => {
    status.value = getBackupStatus(address())
  }
  refreshStatus()

  const canSubmit = computed(
    () => answers.value.length > 0 && answers.value.every((a) => a.trim().length > 0)
  )

  /** Готовит новый челлендж: грузит секрет и выбирает позиции. */
  const start = async (): Promise<boolean> => {
    loading.value = true
    error.value = ''
    try {
      const addr = address()
      if (!addr) throw new Error(t('accountMsg.noActiveAccount'))
      const secret = await loadAccountSecret(addr)
      if (!secret) throw new Error(t('accountMsg.noSavedSeedOrKey'))
      if (secret.format === 'mnemonic') {
        kind.value = 'words'
        secretWords = secret.raw.split(/\s+/).filter(Boolean)
        secretKey = ''
        positions.value = pickChallengePositions(secretWords.length)
        answers.value = positions.value.map(() => '')
      } else {
        kind.value = 'key'
        secretWords = []
        secretKey = secret.raw
        positions.value = []
        answers.value = ['']
      }
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : t('accountMsg.keyReadFailed')
      return false
    } finally {
      loading.value = false
    }
  }

  /** Сверяет ответы; при успехе отмечает бэкап проверенным. */
  const submit = (): boolean => {
    const ok =
      kind.value === 'words'
        ? verifyWordChallenge(secretWords, positions.value, answers.value)
        : verifyKeyTail(secretKey, answers.value[0] ?? '')
    if (!ok) {
      error.value = kind.value === 'words' ? t('vault.backupWordsWrong') : t('vault.backupKeyWrong')
      answers.value = answers.value.map(() => '')
      return false
    }
    error.value = ''
    markBackupVerified(address())
    refreshStatus()
    return true
  }

  /** Секрет из памяти долой (модалка закрыта). */
  const dispose = (): void => {
    secretWords = []
    secretKey = ''
    answers.value = []
    positions.value = []
    error.value = ''
  }

  return {
    kind,
    positions,
    answers,
    loading,
    error,
    status,
    canSubmit,
    keyTailChars: KEY_TAIL_CHARS,
    start,
    submit,
    dispose,
    refreshStatus,
  }
}
