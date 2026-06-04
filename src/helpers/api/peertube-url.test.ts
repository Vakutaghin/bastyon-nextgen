import { describe, it, expect } from 'vitest'
import {
  parsePeerTubeUrl,
  getHlsPlaylistUrl,
  getProgressiveVideoUrl,
  getVideoThumbnailUrl,
} from './peertube-url'
import type { PeerTubeVideoInfo } from './peertube-url'

describe('parsePeerTubeUrl', () => {
  it('returns null for empty/null input', () => {
    expect(parsePeerTubeUrl('')).toBeNull()
    expect(parsePeerTubeUrl(null as any)).toBeNull()
    expect(parsePeerTubeUrl(undefined as any)).toBeNull()
  })

  it('parses basic peertube URL', () => {
    const result = parsePeerTubeUrl('peertube://peertube359.pocketnet.app/abc123')
    expect(result).toEqual({
      host: 'peertube359.pocketnet.app',
      videoId: 'abc123',
      type: undefined,
    })
  })

  it('parses URL with type', () => {
    const result = parsePeerTubeUrl('peertube://host.com/videoid/audio')
    expect(result).toEqual({
      host: 'host.com',
      videoId: 'videoid',
      type: 'audio',
    })
  })

  it('returns null for non-peertube URL', () => {
    expect(parsePeerTubeUrl('https://example.com/video')).toBeNull()
  })

  it('returns null for malformed URL', () => {
    expect(parsePeerTubeUrl('peertube://')).toBeNull()
    expect(parsePeerTubeUrl('peertube://host')).toBeNull()
  })

  it('trims whitespace', () => {
    const result = parsePeerTubeUrl('  peertube://host.com/vid123  ')
    expect(result).not.toBeNull()
    expect(result!.videoId).toBe('vid123')
  })

  it('decodes URL-encoded peertube URL', () => {
    const result = parsePeerTubeUrl(
      'peertube%3A%2F%2Fpeertube6new.pocketnet.app%2Fe3113e81-d70c-4eb5-a60a-589ca3bb48e0'
    )
    expect(result).not.toBeNull()
    expect(result!.host).toBe('peertube6new.pocketnet.app')
    expect(result!.videoId).toBe('e3113e81-d70c-4eb5-a60a-589ca3bb48e0')
  })
})

describe('getHlsPlaylistUrl', () => {
  it('returns null for null input', () => {
    expect(getHlsPlaylistUrl(null as any)).toBeNull()
  })

  it('returns playlistUrl from streamingPlaylists', () => {
    const info: PeerTubeVideoInfo = {
      id: 1,
      uuid: 'uuid',
      name: 'test',
      streamingPlaylists: [{ id: 1, playlistUrl: 'https://host/playlist.m3u8' }],
    }
    expect(getHlsPlaylistUrl(info)).toBe('https://host/playlist.m3u8')
  })

  it('falls back to files[0].fileUrl', () => {
    const info: PeerTubeVideoInfo = {
      id: 1,
      uuid: 'uuid',
      name: 'test',
      files: [{ fileUrl: 'https://host/video.mp4' }],
    }
    expect(getHlsPlaylistUrl(info)).toBe('https://host/video.mp4')
  })

  it('returns null when no sources', () => {
    const info: PeerTubeVideoInfo = { id: 1, uuid: 'uuid', name: 'test' }
    expect(getHlsPlaylistUrl(info)).toBeNull()
  })
})

describe('getProgressiveVideoUrl', () => {
  it('returns null for null input', () => {
    expect(getProgressiveVideoUrl(null as any)).toBeNull()
  })

  it('returns null when there are no files', () => {
    const info: PeerTubeVideoInfo = { id: 1, uuid: 'u', name: 'n' }
    expect(getProgressiveVideoUrl(info)).toBeNull()
  })

  it('picks the highest resolution at or below 720p from top-level files', () => {
    const info: PeerTubeVideoInfo = {
      id: 1,
      uuid: 'u',
      name: 'n',
      files: [
        { resolution: { id: 360, label: '360p' }, fileUrl: 'https://h/360.mp4' },
        { resolution: { id: 720, label: '720p' }, fileUrl: 'https://h/720.mp4' },
        { resolution: { id: 1080, label: '1080p' }, fileUrl: 'https://h/1080.mp4' },
      ],
    }
    expect(getProgressiveVideoUrl(info)).toBe('https://h/720.mp4')
  })

  it('falls back to the lowest resolution when all are above 720p', () => {
    const info: PeerTubeVideoInfo = {
      id: 1,
      uuid: 'u',
      name: 'n',
      files: [
        { resolution: { id: 1080, label: '1080p' }, fileUrl: 'https://h/1080.mp4' },
        { resolution: { id: 2160, label: '4k' }, fileUrl: 'https://h/2160.mp4' },
      ],
    }
    expect(getProgressiveVideoUrl(info)).toBe('https://h/1080.mp4')
  })

  it('reads files nested in streamingPlaylists when top-level files are absent', () => {
    const info: PeerTubeVideoInfo = {
      id: 1,
      uuid: 'u',
      name: 'n',
      streamingPlaylists: [
        {
          id: 1,
          playlistUrl: 'https://h/master.m3u8',
          files: [
            { resolution: { id: 480, label: '480p' }, fileUrl: 'https://h/hls-480.mp4' },
            { resolution: { id: 720, label: '720p' }, fileUrl: 'https://h/hls-720.mp4' },
          ],
        },
      ],
    }
    expect(getProgressiveVideoUrl(info)).toBe('https://h/hls-720.mp4')
  })

  it('returns the first file when resolutions are unknown (height 0)', () => {
    const info: PeerTubeVideoInfo = {
      id: 1,
      uuid: 'u',
      name: 'n',
      files: [{ fileUrl: 'https://h/only.mp4' }],
    }
    expect(getProgressiveVideoUrl(info)).toBe('https://h/only.mp4')
  })
})

describe('getVideoThumbnailUrl', () => {
  it('returns null for null inputs', () => {
    expect(getVideoThumbnailUrl(null as any, 'host')).toBeNull()
    expect(getVideoThumbnailUrl({ id: 1, uuid: 'u', name: 'n' }, '')).toBeNull()
  })

  it('returns full thumbnailUrl as-is', () => {
    const info: PeerTubeVideoInfo = {
      id: 1,
      uuid: 'uuid',
      name: 'test',
      thumbnailUrl: 'https://cdn.com/thumb.jpg',
    }
    expect(getVideoThumbnailUrl(info, 'host')).toBe('https://cdn.com/thumb.jpg')
  })

  it('prepends host to relative thumbnailUrl', () => {
    const info: PeerTubeVideoInfo = {
      id: 1,
      uuid: 'uuid',
      name: 'test',
      thumbnailUrl: '/static/thumb.jpg',
    }
    expect(getVideoThumbnailUrl(info, 'host.com')).toBe('https://host.com/static/thumb.jpg')
  })

  it('uses thumbnailPath as fallback', () => {
    const info: PeerTubeVideoInfo = {
      id: 1,
      uuid: 'uuid',
      name: 'test',
      thumbnailPath: '/static/thumbnails/abc.jpg',
    }
    expect(getVideoThumbnailUrl(info, 'host.com')).toBe(
      'https://host.com/static/thumbnails/abc.jpg'
    )
  })

  it('uses previewUrl as fallback', () => {
    const info: PeerTubeVideoInfo = {
      id: 1,
      uuid: 'uuid',
      name: 'test',
      previewUrl: 'https://cdn.com/preview.jpg',
    }
    expect(getVideoThumbnailUrl(info, 'host.com')).toBe('https://cdn.com/preview.jpg')
  })

  it('falls back to uuid-based URL', () => {
    const info: PeerTubeVideoInfo = { id: 1, uuid: 'my-uuid', name: 'test' }
    expect(getVideoThumbnailUrl(info, 'host.com')).toBe(
      'https://host.com/static/thumbnails/my-uuid.jpg'
    )
  })
})
