// Состояние «Содержания»: какие книги раскрыты и какая статья открыта. Узлы
// дерева рекурсивны, поэтому получают его через inject, а не по цепочке пропсов.
import { inject, type InjectionKey, type Ref } from 'vue'

export interface HelpTree {
  expanded: Ref<ReadonlySet<string>>
  current: Ref<string | null>
  toggle: (id: string) => void
  expand: (id: string) => void
  open: (id: string) => void
}

export const HELP_TREE: InjectionKey<HelpTree> = Symbol('help-tree')

export function useHelpTree(): HelpTree {
  const tree = inject(HELP_TREE)
  if (!tree) throw new Error('help contents node outside of the contents tree')
  return tree
}
