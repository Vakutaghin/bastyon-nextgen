// Смена видимости списка: личный ↔ публичный.
//
// Личный → публичный: окно «Создать» с теми же названием и записями, «Кто
// видит» — «Все». Личный список удаляется, только когда новая коллекция попала
// в блок (collections-store, `replaces`): не попала — он остаётся.
//
// Публичный → личный: сначала появляется личный список с теми же записями,
// потом публичная коллекция удаляется из сети (транзакция). Не удалось удалить
// — личный уже есть, ничего не теряется. Описание и обложку личный не хранит.

import { useI18n } from 'vue-i18n'
import { Modal } from 'ant-design-vue'
import { appToast } from '@/b-components/app-toast'
import { useMediaLibrary } from '@/composables/use-media-library'
import { useCollectionEditorStore } from '@/stores/collection-editor-store'
import { draftOf, type CollectionView } from '@/stores/collections-store'
import { Z_INDEX } from '@/styles/design-tokens'

export function useListVisibility() {
  const { t } = useI18n()
  const { library, collections } = useMediaLibrary()
  const editor = useCollectionEditorStore()

  /** Личный список — в окно «Создать» публичным. */
  function makePublic(listId: string): void {
    const kind = library.kindOf(listId)
    if (!kind) return
    editor.open({
      mode: 'create',
      kind,
      kinds: [kind],
      visibility: 'public',
      lockVisibility: true,
      caption: library.nameOf(listId),
      initialIds: library.ids(listId),
      replaces: listId,
    })
  }

  /**
   * Публичная коллекция — личным списком. `onDone` — после того как личный
   * появился (например, перейти на него).
   */
  function makePrivate(collection: CollectionView, onDone?: (listId: string) => void): void {
    const name = collection.caption || t('media.untitled')
    Modal.confirm({
      title: t('lists.makePrivateTitle', { name }),
      content: t('lists.makePrivateText'),
      okText: t('lists.makePrivate'),
      cancelText: t('collections.cancel'),
      zIndex: Z_INDEX.CONFIRM,
      onOk: async () => {
        const listId = library.createPlaylist(collection.kind, name, collection.contentIds)
        if (!listId) {
          appToast.error({ message: t('library.tooManyPlaylists') })
          return
        }
        try {
          await collections.remove(collection.txid, draftOf(collection))
          appToast.success({ message: t('lists.madePrivate', { name }) })
        } catch (e) {
          const reason = e instanceof Error ? e.message : t('collections.sendFailed')
          appToast.warning({ message: t('lists.madePrivateKept', { reason }) })
        }
        onDone?.(listId)
      },
    })
  }

  return { makePublic, makePrivate }
}
