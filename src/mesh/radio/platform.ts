/**
 * Транспорт до радио на этой платформе: десктоп (Tauri, Rust) или Android
 * (Capacitor, Java-плагин). Интерфейс один — протоколы не знают, где они.
 * Модуль Android грузится только на Android.
 */

import { isCapacitor } from '@/b-components/video-uploader/utils/environment'
import * as tauri from './tauri-radio'
import type { BleDeviceInfo, ByteLink, GattLink, SerialPortInfo } from './types'
import { RadioError } from './types'

export type RadioPlatform = 'tauri' | 'android'

function isAndroid(): boolean {
  if (!isCapacitor()) return false
  const cap = (window as Window & { Capacitor?: { getPlatform?: () => string } }).Capacitor
  return cap?.getPlatform?.() === 'android'
}

/** Где радио подключается; null — здесь не подключается (веб, iOS). */
export function radioPlatform(): RadioPlatform | null {
  if (tauri.isTauriRadioAvailable()) return 'tauri'
  if (isAndroid()) return 'android'
  return null
}

export function isRadioSupported(): boolean {
  return radioPlatform() !== null
}

async function android() {
  const mod = await import('./capacitor-radio')
  if (!mod.isCapacitorRadioAvailable()) throw new RadioError('unsupported')
  return mod
}

export async function listSerialPorts(): Promise<SerialPortInfo[]> {
  return radioPlatform() === 'android'
    ? (await android()).listSerialPorts()
    : tauri.listSerialPorts()
}

export async function openSerial(path: string, baud?: number): Promise<ByteLink> {
  return radioPlatform() === 'android'
    ? (await android()).openSerial(path, baud)
    : tauri.openSerial(path, baud)
}

export async function openTcp(host: string, port: number): Promise<ByteLink> {
  return radioPlatform() === 'android'
    ? (await android()).openTcp(host, port)
    : tauri.openTcp(host, port)
}

export async function scanBle(services: string[], timeoutMs?: number): Promise<BleDeviceInfo[]> {
  return radioPlatform() === 'android'
    ? (await android()).scanBle(services, timeoutMs)
    : tauri.scanBle(services, timeoutMs)
}

export async function connectBle(id: string, label?: string): Promise<GattLink> {
  return radioPlatform() === 'android'
    ? (await android()).connectBle(id, label)
    : tauri.connectBle(id, label)
}

/**
 * Системное уведомление о сообщении по радио на Android (в фоне). На
 * десктопе уведомления показывает сам мессенджер — false.
 */
export function showRadioNotification(title: string, body: string): boolean {
  if (radioPlatform() !== 'android') return false
  void android()
    .then((m) => m.showMessageNotification(title, body))
    .catch(() => {})
  return true
}
