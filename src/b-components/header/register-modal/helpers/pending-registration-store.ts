// Реэкспорт: хранилище незавершённой регистрации живёт в blockchain/storage
// (его читает и restore-session), здесь — только путь для старых импортёров.
export {
  savePendingRegistration,
  loadPendingRegistration,
  peekPendingRegistration,
  clearPendingRegistration,
  clearPendingRegistrationFor,
  markPendingRegistrationStep,
  type PendingRegistration,
} from '@/blockchain/storage/pending-registration'
