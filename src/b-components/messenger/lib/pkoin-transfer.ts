/**
 * Сообщение о переводе PKOIN в личном чате.
 *
 * Уходит обычным зашифрованным сообщением (как любой текст, P0-2): тело —
 * читаемая строка «💎 1.5 PKOIN · За кофе», её показывают прежний Bastyon и
 * forta.chat. Карточку наш клиент рисует по открытому полю
 * `pocketnet_transaction` — в нём только то, что и так видно в блокчейне
 * (txid, сумма, адреса). Заметка к переводу есть лишь в зашифрованном теле.
 */

export interface SendPkoinPayload {
  txid: string
  amount: number
  fromAddress: string
  toAddress: string
  message?: string
}

/** Данные карточки перевода (`Message.info.transaction`). */
export interface PkoinTransferInfo {
  txid: string
  amount: number
  from: string
  to: string
  message?: string
}

/** 1.5 → «1.5», 1e-8 → «0.00000001»: без экспоненты и хвостовых нулей. */
export function formatPkoinAmount(amount: number): string {
  if (!Number.isFinite(amount)) return '—'
  if (Number.isInteger(amount)) return amount.toString()
  return amount.toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
}

export function pkoinTransferText(amount: number, note?: string): string {
  const head = `💎 ${formatPkoinAmount(amount)} PKOIN`
  return note ? `${head} · ${note}` : head
}

/** Заметка из текста {@link pkoinTransferText}; '' — если заметки нет. */
export function pkoinTransferNote(text: string): string {
  return /^💎 \S+ PKOIN · ([\s\S]+)$/u.exec(text)?.[1] ?? ''
}

/** Открытая часть события: всё, кроме заметки. */
export function pkoinTransferContent(payload: SendPkoinPayload): Record<string, unknown> {
  return {
    pocketnet_transaction: {
      txid: payload.txid,
      amount: payload.amount,
      from: payload.fromAddress,
      to: payload.toAddress,
    },
  }
}

/**
 * Перевод из forta.chat: расшифрованное тело — JSON
 * `{"_transfer":true,"txId":…,"amount":…,"from":…,"to":…,"message":…}`.
 */
export function parseFortaTransfer(value: unknown): PkoinTransferInfo | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (v._transfer !== true || typeof v.txId !== 'string' || !v.txId) return null
  const amount = Number(v.amount)
  return {
    txid: v.txId,
    amount: Number.isFinite(amount) ? amount : NaN,
    from: typeof v.from === 'string' ? v.from : '',
    to: typeof v.to === 'string' ? v.to : '',
    message: typeof v.message === 'string' ? v.message : '',
  }
}
