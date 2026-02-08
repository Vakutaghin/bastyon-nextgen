/**
 * Web Worker для обработки файлов
 * Выполняет чтение файлов и создание Blob в отдельном потоке
 * Оптимизировано для работы с большими файлами (до 4GB)
 */

// Обработчик сообщений от основного потока
self.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data

  try {
    switch (type) {
      case 'READ_FILE': {
        // Получаем ArrayBuffer через Transferable
        const { arrayBuffer } = payload as { arrayBuffer: ArrayBuffer }
        
        // Для очень больших файлов конвертируем порциями, чтобы не блокировать Worker
        const chunkSize = 100 * 1024 * 1024 // 100MB порции
        const totalSize = arrayBuffer.byteLength
        
        if (totalSize > chunkSize) {
          // Для больших файлов конвертируем порциями и отправляем прогресс
          const result: number[] = []
          const uint8Array = new Uint8Array(arrayBuffer)
          
          for (let offset = 0; offset < totalSize; offset += chunkSize) {
            const end = Math.min(offset + chunkSize, totalSize)
            const chunk = uint8Array.slice(offset, end)
            result.push(...Array.from(chunk))
            
            // Отправляем прогресс каждые 100MB
            if (offset % chunkSize === 0 || end === totalSize) {
              self.postMessage({
                type: 'FILE_READ_PROGRESS',
                payload: { 
                  progress: (end / totalSize) * 100,
                  processed: end,
                  total: totalSize
                }
              })
            }
          }
          
          self.postMessage({
            type: 'FILE_READ',
            payload: { data: result }
          })
        } else {
          // Для маленьких файлов конвертируем сразу
          const uint8Array = new Uint8Array(arrayBuffer)
          const data = Array.from(uint8Array)
          
          self.postMessage({
            type: 'FILE_READ',
            payload: { data }
          })
        }
        break
      }

      case 'CREATE_BLOB': {
        // buffer приходит через transfer list из main thread (без клонирования)
        const { buffer, mimeType } = payload as { buffer: ArrayBuffer; mimeType: string }
        if (!buffer || !(buffer instanceof ArrayBuffer)) {
          throw new Error('CREATE_BLOB: expected transferred ArrayBuffer')
        }
        const blob = new Blob([buffer], { type: mimeType })
        self.postMessage(
          { type: 'BLOB_CREATED', payload: { blob } },
          [blob]
        )
        break
      }

      default:
        self.postMessage({
          type: 'ERROR',
          payload: { error: `Unknown message type: ${type}` }
        })
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      payload: { error: error instanceof Error ? error.message : String(error) }
    })
  }
}
