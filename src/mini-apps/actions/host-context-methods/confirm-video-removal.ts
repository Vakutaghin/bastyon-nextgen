// Диалог подтверждения `videos.remove` от мини-аппы (K2/Р7): приложение,
// хост и id видео — каждый раз, grant не запоминается (как uniq-permission).
import { Modal } from 'ant-design-vue'
import { t } from '@/i18n'
import type { VideoRemovalRequest } from './media-upload'

export function confirmVideoRemoval(req: VideoRemovalRequest): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('appMsg.miniapps.videoRemoveTitle', { app: req.appName }),
      content: t('appMsg.miniapps.videoRemoveBody', { host: req.host, id: req.videoId }),
      okText: t('appMsg.miniapps.videoRemoveOk'),
      okType: 'danger',
      cancelText: t('appMsg.permission.deny'),
      centered: true,
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
}
