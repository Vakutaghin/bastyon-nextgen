// Ленивая загрузка узла IPFS (ipfs-node.ts, ~400 КБ gzip): чанк приходит только
// с первой ссылкой. Не загрузился или не запускается (старый движок, нет сети)
// — NodeUnavailableError, и окно предлагает открыть ссылку в браузере.
import { NodeUnavailableError } from './ipfs-errors'

type NodeModule = typeof import('./ipfs-node')

let loaded: NodeModule | null = null

export async function loadIpfsNode(): Promise<NodeModule> {
  if (loaded) return loaded
  try {
    loaded = await import('./ipfs-node')
  } catch (e) {
    throw new NodeUnavailableError(e instanceof Error ? e.message : String(e))
  }
  return loaded
}

/** Остановить узел, если его уже загружали: например, включили Tor. */
export function stopIpfsNode(): void {
  void loaded?.stopNode()
}
