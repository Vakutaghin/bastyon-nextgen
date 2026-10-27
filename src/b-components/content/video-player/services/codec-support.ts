/**
 * Умеет ли окно декодировать H.264 — кодек роликов PeerTube.
 *
 * Приложение на Linux показывает страницу через WebKitGTK, а тот играет видео
 * через системный GStreamer. Декодер H.264 (и AAC) там — в пакете
 * gstreamer1.0-libav, которого в обычной установке Ubuntu нет: WebKit требует
 * только base и good. Без него hls.js не запускается, mp4 падает с «формат не
 * поддерживается», и человек видел «Ошибка воспроизведения видео» без
 * объяснения. Теперь плеер не пытается играть, а говорит, чего не хватает.
 */

import { isTauri } from '@/b-components/video-uploader/utils/environment'
import { detectViewerOs } from '@/helpers/ipfs/ipfs-content'

const H264 = 'video/mp4; codecs="avc1.42E01E"'

/** Команда, которая ставит декодер в Debian, Ubuntu и Linux Mint. */
export const LINUX_CODEC_COMMAND = 'sudo apt install gstreamer1.0-libav'

export function canDecodeH264(): boolean {
  if (typeof document === 'undefined') return true
  try {
    if (typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(H264)) return true
    return document.createElement('video').canPlayType(H264) !== ''
  } catch {
    // Спросить не вышло — пусть плеер пробует, как раньше.
    return true
  }
}

/** Приложение для компьютера на Linux: кодеки берутся из системы. */
export function isLinuxDesktopApp(): boolean {
  return isTauri() && detectViewerOs() === 'linux'
}
