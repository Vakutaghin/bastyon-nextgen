/**
 * Archived peertube-серверы — раньше использовались для хостинга видео
 * пользователей Bastyon. Сейчас выведены из эксплуатации, видео перенесены
 * на `peertube.archive.pocketnet.app`. SDK миниапп ремапит URL'ы через этот
 * список (`sdk.manageBastyonImageSrc`).
 *
 * Тот же список, что legacy `project_config.archivedPeertubeServers` (его
 * отдаёт прокси, `/peertubeserversList`); ведётся в одном месте — в
 * `peertube-archive.ts`, там же им пользуется плеер.
 */
export { ARCHIVED_PEERTUBE_HOSTS as ARCHIVED_PEERTUBE_SERVERS } from '@/helpers/api/peertube-archive'
