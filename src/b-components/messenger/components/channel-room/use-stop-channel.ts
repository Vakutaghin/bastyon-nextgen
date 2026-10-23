import { t } from '@/i18n'
import { appToast } from '@/b-components/app-toast'
import { useMessengerStore } from '../../store'
import { useMessengerChannelsStore } from '../../store/messenger-channels-store'
import { channelChatId } from '../../lib/channels'

/**
 * «Не читать в мессенджере»: канал уходит из списка сразу, без вопроса —
 * вернуть можно нажатием на тост (или снова из профиля).
 */
export function useStopChannel(): (address: string, name: string) => void {
  const store = useMessengerStore()
  const channels = useMessengerChannelsStore()

  return (address, name) => {
    if (store.activeChatId === channelChatId(address)) store.activeChatId = null
    channels.setChannel(address, false)
    appToast.info({
      key: `channel-stop-${address}`,
      message: t('messenger.channel.stopped', { name }),
      description: t('messenger.channel.undoHint'),
      onClick: () => {
        channels.setChannel(address, true)
        appToast.success({
          key: `channel-stop-${address}`,
          message: t('messenger.channel.restored', { name }),
        })
      },
    })
  }
}
