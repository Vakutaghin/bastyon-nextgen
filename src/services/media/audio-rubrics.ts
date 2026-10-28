// Рубрики раздела «Аудио» — по тегам постов: у аудио в сети нет поля «жанр»,
// зато теги стоят почти у всех («музыка», «аудиокнига», «подкаст»). Нода
// отбирает посты с любым из тегов. Теги — на основных языках ленты.

export type AudioRubric = 'all' | 'music' | 'audiobooks' | 'podcasts'

export const AUDIO_RUBRICS: readonly AudioRubric[] = ['all', 'music', 'audiobooks', 'podcasts']

export const AUDIO_RUBRIC_TAGS: Readonly<Record<AudioRubric, readonly string[]>> = {
  all: [],
  music: [
    'музыка',
    'music',
    'песни',
    'песня',
    'songs',
    'song',
    'музыкант',
    'рок',
    'rock',
    'джаз',
    'jazz',
  ],
  audiobooks: [
    'аудиокнига',
    'аудиокниги',
    'audiobook',
    'audiobooks',
    'книги',
    'литература',
    'чтение',
  ],
  podcasts: [
    'подкаст',
    'подкасты',
    'podcast',
    'podcasts',
    'интервью',
    'interview',
    'лекция',
    'лекции',
    'радио',
  ],
}
