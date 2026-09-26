// Файл больше лимита чат-сервер не примет. Раньше такой файл молча не
// уходил (только console.error) — теперь человек видит, почему, и как
// отправить иначе: через IPFS на десктопе.
import { t } from '@/i18n'
import { appToast } from '@/b-components/app-toast'
import { formatFileSize } from '../file-message/helpers'
import {
  FILE_SIZE_LIMIT_BYTES,
  IMAGE_SIZE_LIMIT_BYTES,
} from '../../store/messenger-chat-store/use-media-sending'

/** true — файл слишком большой для чата, человеку показано предупреждение. */
export function tooLargeForChat(file: File, canSendIpfs: boolean): boolean {
  const limit = file.type.startsWith('image/') ? IMAGE_SIZE_LIMIT_BYTES : FILE_SIZE_LIMIT_BYTES
  if (file.size <= limit) return false
  appToast.warning({
    message: t('messenger.fileTooLarge', { name: file.name, limit: formatFileSize(limit) }),
    description: t(canSendIpfs ? 'messenger.fileTooLargeIpfs' : 'messenger.fileTooLargeDesktop'),
  })
  return true
}
