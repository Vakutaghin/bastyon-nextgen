// Типы видео-загрузчика

/** Состояние процесса загрузки видео */
export type UploadState =
  | 'idle'
  | 'analyzing'
  | 'ready'
  | 'transcoding'
  | 'saving'
  | 'completed'
  | 'error'
