export const filtersData = {
  // Окна времени для «Сначала лучшее» (gettopfeed). Список ограничен тем, что
  // нода реально успевает посчитать: `depth` там измеряется в блоках, и уже на
  // месяце (43200 блоков) запрос отдаёт `GetTopFeed: sql request timeout`
  // (живая проба к 1.pocketnet.app:8899, 2026-09-23). Legacy по той же причине
  // ходит с depth 7000–10000. См. TIME_FILTER_DEPTH_MAP.
  timeFilters: [
    { id: 1, labelKey: 'sidebarData.timeFilters.today', active: false },
    { id: 2, labelKey: 'sidebarData.timeFilters.threeDays', active: false },
    { id: 3, labelKey: 'sidebarData.timeFilters.week', active: true },
  ],
  sortFilters: [
    { id: 1, labelKey: 'sidebarData.sortFilters.popularity', active: true },
    { id: 2, labelKey: 'sidebarData.sortFilters.date', active: false },
    { id: 3, labelKey: 'sidebarData.sortFilters.rating', active: false },
    { id: 4, labelKey: 'sidebarData.sortFilters.comments', active: false },
  ],
}
