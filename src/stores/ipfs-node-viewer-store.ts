import { defineStore } from 'pinia'
import type { IpfsTarget } from '@/helpers/ipfs/ipfs-link'

// Окно просмотра IPFS-ссылок там, где своей ноды нет: веб, телефон и
// компьютер без модуля. Содержимое качает узел в самом приложении
// (helpers/ipfs/ipfs-node.ts). Окно одно; новая ссылка открывается в нём же.

export const useIpfsNodeViewerStore = defineStore('ipfs-node-viewer', {
  state: () => ({
    open: false,
    target: null as IpfsTarget | null,
    /** Размер из ссылки, если он там был. */
    size: null as number | null,
    /** Растёт с каждой открытой ссылкой: окно начинает заново, даже если ссылка та же. */
    seq: 0,
  }),
  actions: {
    show(target: IpfsTarget, size: number | null = null): void {
      this.target = target
      this.size = size
      this.open = true
      this.seq++
    },
    close(): void {
      this.open = false
    },
  },
})
