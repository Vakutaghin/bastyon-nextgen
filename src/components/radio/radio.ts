import { inject, type ComputedRef, type InjectionKey } from 'vue'

export type RadioValue = string | number

/** Что группа даёт своим радиокнопкам (они могут лежать во вложенной разметке). */
export interface RadioGroupContext {
  name: string
  value: ComputedRef<RadioValue | undefined>
  disabled: ComputedRef<boolean>
  select: (value: RadioValue) => void
}

export const RADIO_GROUP: InjectionKey<RadioGroupContext> = Symbol('ui-radio-group')

export function useRadioGroupContext(): RadioGroupContext | null {
  return inject(RADIO_GROUP, null)
}
