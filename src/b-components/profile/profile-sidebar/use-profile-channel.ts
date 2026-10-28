// «Читать в мессенджере»: посты автора — каналом в мессенджере, рядом с чатами.
// Это выбор читателя, без транзакции; подписка в блокчейне — отдельно.
import { computed, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/blockchain/store/auth-store'
import { appToast } from '@/b-components/app-toast'
import { useMessengerStore } from '@/b-components/messenger/store'
import { useMessengerChannelsStore } from '@/b-components/messenger/store/messenger-channels-store'
import { useStopChannel } from '@/b-components/messenger/components/channel-room/use-stop-channel'

export function useProfileChannel(userAddress: Ref<string>, displayName: Ref<string>) {
  const { t } = useI18n()
  const authStore = useAuthStore()
  const messenger = useMessengerStore()
  const channels = useMessengerChannelsStore()
  const stopChannel = useStopChannel()

  // Список каналов аккаунта — и когда мессенджер ещё не запускался.
  watch(
    () => authStore.isAuthenticated && authStore.getUserAddress,
    (me) => {
      if (me) channels.attach(me)
    },
    { immediate: true }
  )

  /** Не себе. */
  const canShowChannel = computed<boolean>(
    () =>
      !!userAddress.value &&
      authStore.isAuthenticated &&
      authStore.getUserAddress !== userAddress.value
  )

  const isChannelOn = computed<boolean>(() => channels.isOn(userAddress.value))

  function onChannelClick(): void {
    const address = userAddress.value
    if (!address) return
    if (isChannelOn.value) {
      void messenger.openChannel(address)
      return
    }
    channels.setChannel(address, true)
    appToast.success({
      key: `channel-on-${address}`,
      message: t('messenger.channel.added', { name: displayName.value }),
      description: t('messenger.channel.openHint'),
      onClick: () => void messenger.openChannel(address),
    })
  }

  function onChannelStop(): void {
    if (userAddress.value) stopChannel(userAddress.value, displayName.value)
  }

  return { canShowChannel, isChannelOn, onChannelClick, onChannelStop }
}
