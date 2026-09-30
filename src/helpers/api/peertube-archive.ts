/**
 * Выведенные из работы PeerTube-ноды Bastyon и архивы, где лежат их ролики.
 *
 * Команда Bastyon закрывает старые ноды, а ролики с них отдаёт архивный
 * сервер. Ссылка в посте при этом прежняя: `peertube://peertube3501.pocketnet.app/<id>`
 * ведёт на ноду, которой больше нет, и напрямую такой ролик не открыть.
 * Старый клиент ходит за роликами через прокси, а прокси знает, где архив.
 *
 * Список снят 30.09.2026 с того же файла, что читает прокси
 * (github.com/shpingalet007/bastyon-peertubes, `list.json`): 71 нода. Почти
 * все ушли в `peertube.archive.pocketnet.app`, 600-я и 700-я — на 601-ю и
 * 701-ю. Ноду, выведенную позже, найдёт запасной путь через прокси
 * (`getPeerTubeVideoInfo`).
 */

/** Общий архив Bastyon. */
export const PEERTUBE_MAIN_ARCHIVE = 'peertube.archive.pocketnet.app'

/** Ноды, чьи ролики лежат не в общем архиве. */
const ARCHIVED_ELSEWHERE: Readonly<Record<string, string>> = {
  'peertube600.pocketnet.app': 'peertube601.pocketnet.app',
  'peertube700.pocketnet.app': 'peertube701.pocketnet.app',
}

export const ARCHIVED_PEERTUBE_HOSTS: readonly string[] = [
  'pocketnetpeertube1.nohost.me',
  'pocketnetpeertube2.nohost.me',
  'pocketnetpeertube5.nohost.me',
  'pocketnetpeertube7.nohost.me',
  'pocketnetpeertube4.nohost.me',
  'pocketnetpeertube6.nohost.me',
  'pocketnetpeertube8.nohost.me',
  'pocketnetpeertube9.nohost.me',
  'pocketnetpeertube10.nohost.me',
  'pocketnetpeertube11.nohost.me',
  'bastyonmma.pocketnet.app',
  'bastyonmma.nohost.me',
  '01rus.nohost.me',
  '02rus.pocketnet.app',
  'pocketnetpeertube12.nohost.me',
  'pocketnetpeertube13.nohost.me',
  'peertube14.pocketnet.app',
  'peertube15.pocketnet.app',
  'peertube17.pocketnet.app',
  'peertube18.pocketnet.app',
  'peertube19.pocketnet.app',
  'peertube17mirror.pocketnet.app',
  'peertube18mirror.pocketnet.app',
  'peertube19mirror.pocketnet.app',
  'peertube20.pocketnet.app',
  'peertube21.pocketnet.app',
  'peertube22.pocketnet.app',
  'peertube23.pocketnet.app',
  'peertube24.pocketnet.app',
  'peertube25.pocketnet.app',
  'peertube25mirror.pocketnet.app',
  'peertube26.pocketnet.app',
  'peertube26mirror.pocketnet.app',
  'peertube27.pocketnet.app',
  'peertube28.pocketnet.app',
  'peertube29.pocketnet.app',
  'peertube30.pocketnet.app',
  'peertube5new.pocketnet.app',
  'peertube4new.pocketnet.app',
  'peertube6new.pocketnet.app',
  'peertube32.pocketnet.app',
  'peertube33.pocketnet.app',
  'peertube34.pocketnet.app',
  'peertube35.pocketnet.app',
  'peertube31.pocketnet.app',
  'peertube51.pocketnet.app',
  'peertube41.pocketnet.app',
  'peertube70.pocketnet.app',
  'peertube80.pocketnet.app',
  'peertube90.pocketnet.app',
  'peertube100.pocketnet.app',
  'peertube321.pocketnet.app',
  'peertube341.pocketnet.app',
  'peertube351.pocketnet.app',
  'peertube361.pocketnet.app',
  'peertube371.pocketnet.app',
  'peertube400.pocketnet.app',
  'peertube500.pocketnet.app',
  'peertube352.pocketnet.app',
  'peertube600.pocketnet.app',
  'peertube700.pocketnet.app',
  'peertube281.pocketnet.app',
  'peertube353.pocketnet.app',
  'peertube354.pocketnet.app',
  'peertube355.pocketnet.app',
  'peertube356.pocketnet.app',
  'peertube357.pocketnet.app',
  'peertube358.pocketnet.app',
  'peertube359.pocketnet.app',
  'peertube3500.pocketnet.app',
  'peertube3501.pocketnet.app',
]

const ARCHIVED = new Set(ARCHIVED_PEERTUBE_HOSTS)

/** Где лежат ролики выведенной ноды; `null` — нода не в списке выведенных. */
export function peertubeArchiveFor(host: string): string | null {
  const key = host.trim().toLowerCase()
  if (!ARCHIVED.has(key)) return null
  return ARCHIVED_ELSEWHERE[key] ?? PEERTUBE_MAIN_ARCHIVE
}
