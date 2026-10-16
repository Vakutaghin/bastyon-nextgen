export interface Category {
  id: string
  /**
   * i18n-ключ названия категории (для статических категорий из этого файла).
   * Резолвится через t() в компоненте-потребителе.
   */
  labelKey?: string
  /**
   * Сырое название (для кастомных/временных категорий, созданных пользователем
   * во время работы приложения — там лежит введённый тег, а не ключ).
   */
  name?: string
  icon: string
  tags: string[]
}

/** Языки, для которых у legacy свои теги категорий. */
export type CategoryTagsLanguage = 'ru' | 'en' | 'de' | 'es' | 'fr' | 'it' | 'kr' | 'sr'

export interface StaticCategory {
  id: string
  labelKey: string
  icon: string
  tags: Record<CategoryTagsLanguage, string[]>
}

/**
 * Готовые категории — набор, порядок и теги как в legacy
 * (`sdk.categories.data.all` в `js/satolist.js`). Теги перенесены как есть,
 * вместе с огрехами legacy (es «Memes/Humor» с русскими тегами, de `hunor`):
 * этими тегами legacy помечал посты при выборе категории, и фильтр должен
 * находить именно их.
 */
export const categoriesData: StaticCategory[] = [
  {
    id: 'c2',
    labelKey: 'sidebarData.categories.memes',
    icon: '😂',
    tags: {
      ru: ['мемы', 'юмор'],
      en: ['funny', 'memes'],
      de: ['meme', 'hunor'],
      es: ['мемы', 'юмор'],
      fr: ['mèmes', 'humour'],
      it: ['divertente', 'meme'],
      kr: ['밈', '유머'],
      sr: ['смешно', 'меме'],
    },
  },
  {
    id: 'c3',
    labelKey: 'sidebarData.categories.politics',
    icon: '⚖️',
    tags: {
      ru: ['политика'],
      en: ['politics'],
      de: ['politik'],
      es: ['política'],
      fr: ['politique'],
      it: ['politica'],
      kr: ['정치'],
      sr: ['политика'],
    },
  },
  {
    id: 'c4',
    labelKey: 'sidebarData.categories.crypto',
    icon: '₿',
    tags: {
      ru: ['Криптовалюта'],
      en: ['crypto'],
      de: ['Kryptowährung'],
      es: ['criptomoneda'],
      fr: ['Crypto-monnaie'],
      it: ['cripto'],
      kr: ['암호 화폐'],
      sr: ['крипто'],
    },
  },
  {
    id: 'c5',
    labelKey: 'sidebarData.categories.science',
    icon: '🔬',
    tags: {
      ru: ['технологии', 'наука'],
      en: ['technology', 'science'],
      de: ['technologie', 'wissenschaft'],
      es: ['tecnología', 'científica'],
      fr: ['technologie', 'scientifique'],
      it: ['tecnologia', 'scienza'],
      kr: ['기술', '과학'],
      sr: ['технологија', 'наука'],
    },
  },
  {
    id: 'c55',
    labelKey: 'sidebarData.categories.religion',
    icon: '🛐',
    tags: {
      ru: ['вера', 'религия'],
      en: ['faith', 'religion'],
      de: ['glaube', 'religion'],
      es: ['fe', 'religión'],
      fr: ['foi', 'religion'],
      it: ['fede', 'religione'],
      kr: ['신앙', '종교'],
      sr: ['вера', 'религија'],
    },
  },
  {
    id: 'c6',
    labelKey: 'sidebarData.categories.finance',
    icon: '💰',
    tags: {
      ru: ['финансы', 'инвестиции'],
      en: ['investing', 'finance'],
      de: ['finanzen', 'investitionen'],
      es: ['finanzas', 'inversiones'],
      fr: ['finances', 'investissements'],
      it: ['investire', 'finanza'],
      kr: ['금융', '투자'],
      sr: ['инвестиције', 'финансије'],
    },
  },
  {
    id: 'c63',
    labelKey: 'sidebarData.categories.pkoin',
    icon: '🤝',
    tags: {
      ru: ['pkoin_commerce'],
      en: ['pkoin_commerce'],
      de: ['pkoin_commerce'],
      es: ['pkoin_commerce'],
      fr: ['pkoin_commerce'],
      it: ['pkoin_commerce'],
      kr: ['pkoin_commerce'],
      sr: ['pkoin_commerce'],
    },
  },
  {
    id: 'c72',
    labelKey: 'sidebarData.categories.covid',
    icon: '🦠',
    tags: {
      ru: ['covid', 'локдаун'],
      en: ['covid', 'lockdowns'],
      de: ['covid', 'Sperren'],
      es: ['covid', 'сierres'],
      fr: ['covid', 'Verrouillages'],
      it: ['covid', 'quarantena'],
      kr: ['코로나', '잠금'],
      sr: ['ковид', 'закључавања'],
    },
  },
  {
    id: 'c7',
    labelKey: 'sidebarData.categories.auto',
    icon: '🏎️',
    tags: {
      ru: ['auto', 'racing'],
      en: ['auto', 'racing'],
      de: ['autos', 'rennen'],
      es: ['coches', 'carreras'],
      fr: ['voitures', 'courses'],
      it: ['auto', 'dacorsa'],
      kr: ['자동차', '레이싱'],
      sr: ['ауто', 'трке'],
    },
  },
  {
    id: 'c71',
    labelKey: 'sidebarData.categories.bastyon',
    icon: '🌐',
    tags: {
      ru: ['bastyon', 'pocketnet'],
      en: ['bastyon', 'pocketnet'],
      de: ['bastyon', 'pocketnet'],
      es: ['bastyon', 'pocketnet'],
      fr: ['bastyon', 'pocketnet'],
      it: ['bastyon', 'pocketnet'],
      kr: ['bastyon', 'pocketnet'],
      sr: ['bastyon', 'pocketnet'],
    },
  },
  {
    id: 'c8',
    labelKey: 'sidebarData.categories.sport',
    icon: '⚽',
    tags: {
      ru: ['спорт'],
      en: ['sports'],
      de: ['sport'],
      es: ['deporte'],
      fr: ['Sport'],
      it: ['sport'],
      kr: ['스포츠'],
      sr: ['спорт'],
    },
  },
  {
    id: 'c9',
    labelKey: 'sidebarData.categories.games',
    icon: '🎮',
    tags: {
      ru: ['игры'],
      en: ['gaming'],
      de: ['spielen'],
      es: ['juegos'],
      fr: ['jeux'],
      it: ['gioco'],
      kr: ['계략'],
      sr: ['игре'],
    },
  },
  {
    id: 'c11',
    labelKey: 'sidebarData.categories.artMusic',
    icon: '🎨',
    tags: {
      ru: ['искусство', 'музыка'],
      en: ['art', 'music'],
      de: ['kunst', 'music'],
      es: ['arte', 'musical'],
      fr: ['art', 'musique'],
      it: ['arte', 'musica'],
      kr: ['예술', '음악'],
      sr: ['уметност', 'музика'],
    },
  },
  {
    id: 'c12',
    labelKey: 'sidebarData.categories.news',
    icon: '📰',
    tags: {
      ru: ['новости', 'комментарии'],
      en: ['news', 'commentary'],
      de: ['neuigkeiten', 'kommentare'],
      es: ['noticias', 'comentarios'],
      fr: ['nouvelles', 'commentaires'],
      it: ['notizia', 'commento'],
      kr: ['뉴스', '댓글'],
      sr: ['вести', 'коментари'],
    },
  },
  {
    id: 'c13',
    labelKey: 'sidebarData.categories.history',
    icon: '📜',
    tags: {
      ru: ['история'],
      en: ['history'],
      de: ['geschichte'],
      es: ['historia'],
      fr: ['histoire'],
      it: ['storia'],
      kr: ['역사'],
      sr: ['историја'],
    },
  },
  {
    id: 'c14',
    labelKey: 'sidebarData.categories.stories',
    icon: '🔖',
    tags: {
      ru: ['истории'],
      en: ['storytime'],
      de: ['zeit der geschichten '],
      es: ['Tiempo de historias'],
      fr: ['Letempsdeshistoires'],
      it: ['oradellafavola'],
      kr: ['이야기의시간'],
      sr: ['прича'],
    },
  },
  {
    id: 'c15',
    labelKey: 'sidebarData.categories.cinema',
    icon: '🎬',
    tags: {
      ru: ['кино', 'анимация'],
      en: ['film', 'animation'],
      de: ['film', 'animation'],
      es: ['cine', 'animación'],
      fr: ['cinéma', 'animation'],
      it: ['film', 'animazione'],
      kr: ['영화', '애니메이션'],
      sr: ['филм', 'анимација'],
    },
  },
  {
    id: 'c16',
    labelKey: 'sidebarData.categories.nature',
    icon: '🐾',
    tags: {
      ru: ['Природа', 'животные'],
      en: ['nature', 'animals'],
      de: ['natur', 'tiere'],
      es: ['naturaleza', 'animales'],
      fr: ['nature', 'animaux'],
      it: ['nature', 'animali'],
      kr: ['자연', '동물'],
      sr: ['природа', 'животиње'],
    },
  },
  {
    id: 'c17',
    labelKey: 'sidebarData.categories.travel',
    icon: '🗺️',
    tags: {
      ru: ['путешествия', 'архитектура'],
      en: ['travel', 'architecture'],
      de: ['reisen', 'architektur'],
      es: ['viajes', 'arquitectura'],
      fr: ['voyage', 'architecture'],
      it: ['viaggiare', 'architettura'],
      kr: ['여행', '건축'],
      sr: ['путовања', 'архитектура'],
    },
  },
  {
    id: 'c18',
    labelKey: 'sidebarData.categories.diy',
    icon: '🔨',
    tags: {
      ru: ['сделайсам'],
      en: ['diy'],
      de: ['machesselbst'],
      es: ['hazlotumismo'],
      fr: ['faisletoi-même'],
      it: ['faidate'],
      kr: ['너스스로해라'],
      sr: ['уради_сам'],
    },
  },
]

const byLanguage = new Map<CategoryTagsLanguage, Category[]>()

function tagsLanguage(language: string): CategoryTagsLanguage {
  // Китайский legacy хранит под ключом `cmn`, а язык приложения у него `zh` —
  // ключ не совпадает, и китайский интерфейс получает английские теги.
  const known: readonly string[] = ['ru', 'en', 'de', 'es', 'fr', 'it', 'kr', 'sr']
  return (known.includes(language) ? language : 'en') as CategoryTagsLanguage
}

/**
 * Готовые категории с тегами для языка интерфейса. Теги в нижнем регистре:
 * legacy приводит их к нему перед запросом ленты, а нода сравнивает теги
 * с учётом регистра («Криптовалюта» находит два поста 2021 года).
 */
export function categoriesForLanguage(language: string): Category[] {
  const lang = tagsLanguage(language)
  let list = byLanguage.get(lang)
  if (!list) {
    list = categoriesData.map(({ tags, ...category }) => ({
      ...category,
      tags: tags[lang].map((tag) => tag.toLowerCase()),
    }))
    byLanguage.set(lang, list)
  }
  return list
}
