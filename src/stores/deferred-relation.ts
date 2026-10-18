/**
 * Переключатель отношения с человеком (подписка, блокировка), который можно
 * нажимать, не дожидаясь блока.
 *
 * Пока транзакция по адресу не в блоке, вторую по тому же адресу нода
 * отклонит: консенсус смотрит в цепочку, а там первой ещё нет («вы не
 * подписаны», «уже заблокирован»). Поэтому повторное нажатие сразу меняет
 * кнопку, а транзакция уходит после блока — если выбор к тому времени всё ещё
 * отличается от отправленного. Подписался и тут же отписался — отписка уйдёт
 * следом за подпиской; передумал ещё раз — не уйдёт ничего.
 */

export interface DeferredRelationOps<S> {
  /** Что сейчас показано по адресу. */
  shown(address: string): S
  /** Показать состояние в интерфейсе. */
  show(address: string, state: S): void
  /** Отправить транзакцию, которая приведёт цепочку к `state`; вернёт txid. */
  send(address: string, state: S): Promise<string>
  /** Идёт отправка: кнопка крутится и не нажимается. */
  setSending(address: string, sending: boolean): void
  /** Транзакция по адресу, ушедшая до перезапуска и ещё не в блоке. */
  findUnconfirmed?(address: string): { txid: string; state: S } | null
  /** Транзакция ушла (и та, что сразу, и та, что из очереди). */
  afterSent?(address: string, state: S): void
  /** Отложенная транзакция не ушла: вызывающего уже нет, сказать некому. */
  onDeferredError(error: unknown): void
  /** Очередь изменилась — сохранить её на случай перезапуска. */
  onQueueChange?(): void
}

/** Транзакция в пути: `txid` — null, пока её строим и отправляем. */
interface Flight<S> {
  txid: string | null
  state: S
}

export class DeferredRelation<S> {
  private readonly flights = new Map<string, Flight<S>>()
  private readonly queued = new Map<string, S>()

  constructor(private readonly ops: DeferredRelationOps<S>) {}

  /**
   * Выбор человека. `sent` — транзакция ушла сразу; `queued` — уйдёт после
   * блока; `none` — менять нечего (или идёт отправка и кнопка заблокирована).
   */
  async set(address: string, next: S): Promise<'sent' | 'queued' | 'none'> {
    if (!address) return 'none'
    this.adoptUnconfirmed(address)
    const flight = this.flights.get(address)
    if (flight) {
      if (flight.txid === null) return 'none'
      this.ops.show(address, next)
      if (next === flight.state) this.queued.delete(address)
      else this.queued.set(address, next)
      this.ops.onQueueChange?.()
      return 'queued'
    }
    if (next === this.ops.shown(address)) return 'none'
    await this.send(address, next, this.ops.shown(address))
    return 'sent'
  }

  /** Есть ли по адресу транзакция в пути или выбор в очереди. */
  isWaiting(address: string): boolean {
    return this.flights.has(address) || this.queued.has(address)
  }

  /**
   * Ожидание по транзакции снято. В блоке — отправляем выбор из очереди, если
   * он отличается. Не попала в блок — что в цепочке, неизвестно: вернёт true,
   * и вызывающий перечитает состояние из ноды и позовёт reconcile().
   */
  settle(txid: string, confirmed: boolean): boolean {
    for (const [address, flight] of this.flights) {
      if (flight.txid !== txid) continue
      this.flights.delete(address)
      if (!confirmed) return true
      const want = this.queued.get(address)
      this.queued.delete(address)
      this.ops.onQueueChange?.()
      if (want !== undefined && want !== flight.state) {
        this.send(address, want, flight.state).catch((e: unknown) => this.ops.onDeferredError(e))
      }
      return false
    }
    return false
  }

  /**
   * Состояние перечитано из ноды (`chain`): выборы из очереди без транзакции в
   * пути отправляем или забываем, а ожидания снова показываем поверх цепочки.
   */
  reconcile(chain: (address: string) => S): void {
    for (const [address, want] of [...this.queued]) {
      // Первая транзакция после перезапуска ещё в пути — ждём её блока.
      this.adoptUnconfirmed(address)
      if (this.flights.has(address)) continue
      this.queued.delete(address)
      const state = chain(address)
      if (want !== state) {
        this.send(address, want, state).catch((e: unknown) => this.ops.onDeferredError(e))
      }
    }
    this.ops.onQueueChange?.()
    for (const [address, flight] of this.flights) this.ops.show(address, flight.state)
    for (const [address, want] of this.queued) this.ops.show(address, want)
  }

  /** Очередь для сохранения между запусками. */
  queueEntries(): Array<[string, S]> {
    return [...this.queued]
  }

  /** Очередь с прошлого запуска; выполнится в reconcile(). */
  restoreQueue(entries: Array<[string, S]>): void {
    for (const [address, state] of entries) this.queued.set(address, state)
  }

  clear(): void {
    this.flights.clear()
    this.queued.clear()
  }

  private adoptUnconfirmed(address: string): void {
    if (this.flights.has(address)) return
    const pending = this.ops.findUnconfirmed?.(address)
    if (pending) this.flights.set(address, { txid: pending.txid, state: pending.state })
  }

  private async send(address: string, next: S, chain: S): Promise<void> {
    this.flights.set(address, { txid: null, state: next })
    this.ops.setSending(address, true)
    this.ops.show(address, next)
    try {
      const txid = await this.ops.send(address, next)
      this.flights.set(address, { txid, state: next })
      this.ops.afterSent?.(address, next)
    } catch (e) {
      this.flights.delete(address)
      if (this.queued.delete(address)) this.ops.onQueueChange?.()
      this.ops.show(address, chain)
      throw e
    } finally {
      this.ops.setSending(address, false)
    }
  }
}
