// Реэкспорт основного стора, чтобы импорты `@/b-components/messenger/store`
// и `'../../store'` резолвились сюда после удаления legacy-файла store.ts.
export { useMessengerStore } from './messenger-store'
