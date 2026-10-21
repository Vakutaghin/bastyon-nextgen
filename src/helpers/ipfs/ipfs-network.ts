// Где узел IPFS в браузере ищет, кто раздаёт содержимое. Одно место: если
// сервис закроется, как закрылись публичные шлюзы в сентябре 2026, менять
// только здесь.
//
// Delegated routing (`/routing/v1`) отвечает списком узлов с адресами. Сами
// блоки через эти сервисы не идут: их браузер берёт у найденных узлов.
//  - delegated-ipfs.dev — DHT целиком (Protocol Labs), проверено 21.10.2026;
//  - cid.contact — индекс IPNI: туда объявляют содержимое pinning-сервисы и
//    хранилища Filecoin, которых в DHT бывает не видно.
//
// Узлы bootstrap — по умолчанию Helia (bootstrap.libp2p.io).

export const DELEGATED_ROUTERS: readonly string[] = [
  'https://delegated-ipfs.dev',
  'https://cid.contact',
]
