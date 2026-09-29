// Значки плеера — залитые, как у YouTube: контурные значки приложения на видео
// читались хуже и выглядели чужими. Пути — Material Icons (Apache License 2.0).
// Размер задаёт кнопка: svg растягивается на её значок.

import { h, type FunctionalComponent } from 'vue'

function icon(name: string, ...paths: string[]): FunctionalComponent {
  const component: FunctionalComponent = () =>
    h(
      'svg',
      {
        viewBox: '0 0 24 24',
        width: '100%',
        height: '100%',
        fill: 'currentColor',
        'aria-hidden': 'true',
        focusable: 'false',
      },
      paths.map((d) => h('path', { d }))
    )
  component.displayName = name
  return component
}

export const PlayIcon = icon('PlayIcon', 'M8 5v14l11-7z')

export const PauseIcon = icon('PauseIcon', 'M6 5h4v14H6zM14 5h4v14h-4z')

export const ReplayIcon = icon(
  'ReplayIcon',
  'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z'
)

export const VolumeUpIcon = icon(
  'VolumeUpIcon',
  'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z'
)

export const VolumeDownIcon = icon(
  'VolumeDownIcon',
  'M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z'
)

export const VolumeOffIcon = icon(
  'VolumeOffIcon',
  'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z'
)

export const SettingsIcon = icon(
  'SettingsIcon',
  'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z'
)

export const FullscreenIcon = icon(
  'FullscreenIcon',
  'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z'
)

export const FullscreenExitIcon = icon(
  'FullscreenExitIcon',
  'M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z'
)

export const PipIcon = icon(
  'PipIcon',
  'M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z'
)

export const CheckIcon = icon('CheckIcon', 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z')

export const ChevronRightIcon = icon(
  'ChevronRightIcon',
  'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z'
)

export const ChevronLeftIcon = icon(
  'ChevronLeftIcon',
  'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z'
)

/** «Качество» в меню настроек. */
export const TuneIcon = icon(
  'TuneIcon',
  'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z'
)

/** «Скорость» в меню настроек. */
export const SpeedIcon = icon(
  'SpeedIcon',
  'M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z'
)

/** Треугольник для стрелок перемотки: три таких подряд бегут в сторону перемотки. */
export const SeekArrowIcon = icon('SeekArrowIcon', 'M6 4l12 8-12 8z')

export const CloseIcon = icon(
  'CloseIcon',
  'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'
)
