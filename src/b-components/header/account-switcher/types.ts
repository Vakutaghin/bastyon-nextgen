import type { Address } from '@/blockchain/types/addresses'
import type { UserMark } from '@/helpers/profile/user-mark'

export interface Props {
  open?: boolean
}

export interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'close'): void
}

export interface AccountDisplayInfo {
  address: Address
  name: string | null
  avatar: string | null
  balance: number | null
  loading: boolean
  verified?: boolean
  /** Значок у аватара: проверенный, модератор, «акула». */
  mark?: UserMark | null
}
