import type { PluginListenerHandle } from '@capacitor/core'

export interface BackgroundMediaStartOptions {
  /** Track title shown on the lock screen. */
  title: string
  /** Author / channel name shown below the title. */
  artist?: string
  /** Remote URL to use as artwork (album art / poster). */
  artworkUrl?: string
  /** Total track length in seconds. */
  duration?: number
  /** Initial position in seconds. */
  position?: number
  /** Whether playback starts in the playing state. */
  isPlaying?: boolean
  /** Playback rate (1.0 = normal). */
  playbackSpeed?: number
}

export type BackgroundMediaUpdateOptions = Partial<BackgroundMediaStartOptions>

export interface BackgroundMediaSeekEvent {
  positionMs: number
}

/**
 * Native control surface for background media playback.
 *
 * On Android this owns a foreground service + MediaSession; on iOS the
 * plumbing relies on UIBackgroundModes + AVAudioSession (and the JS still
 * publishes navigator.mediaSession metadata directly). On web the plugin
 * is a no-op.
 */
export interface BackgroundMediaPlugin {
  start(options: BackgroundMediaStartOptions): Promise<void>
  update(options: BackgroundMediaUpdateOptions): Promise<void>
  stop(): Promise<void>
  isSupported(): Promise<{ supported: boolean }>

  addListener(eventName: 'play' | 'pause' | 'stop', cb: () => void): Promise<PluginListenerHandle>
  addListener(
    eventName: 'seekTo',
    cb: (event: BackgroundMediaSeekEvent) => void
  ): Promise<PluginListenerHandle>
}
