/** Контейнер слоёв в конце body: сюда телепортируются окна и панели. */
export const LAYER_ROOT_ID = 'ui-layers'

/** Контейнер слоёв; создаётся при первом обращении. */
export function layerRoot(doc: Document = document): HTMLElement {
  const found = doc.getElementById(LAYER_ROOT_ID)
  if (found) return found
  const root = doc.createElement('div')
  root.id = LAYER_ROOT_ID
  doc.body.appendChild(root)
  return root
}
