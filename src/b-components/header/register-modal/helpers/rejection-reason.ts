// Причина отказа ноды в регистрации — словами. Нода отвечает кодом консенсуса
// (18 — имя занято, 19 — длиннее лимита) или его именем; прочее — как есть.
import { t } from '@/i18n'

export function registrationRejectionReason(message: string): string {
  if (/NicknameDouble|code"?:\s?18\b/.test(message)) return t('accountMsg.rejectNameTaken')
  if (/NicknameLong|code"?:\s?19\b/.test(message)) return t('accountMsg.rejectNameLong')
  return message
}
