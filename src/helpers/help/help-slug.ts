// Якоря заголовков — по правилам GitHub (github-slugger): ссылка
// `статья.md#раздел` ведёт в одно и то же место и на GitHub, и в приложении.

/** Всё, кроме букв, цифр, знаков-модификаторов, `_`, дефиса и пробела. */
const STRIP = /[^\p{L}\p{M}\p{N}\p{Pc} -]/gu

export function githubSlug(text: string): string {
  return text.toLowerCase().replace(STRIP, '').replace(/ /g, '-')
}

/** Одинаковые заголовки в одной статье получают `-1`, `-2`… — как на GitHub. */
export class Slugger {
  private readonly seen = new Map<string, number>()

  slug(text: string): string {
    const base = githubSlug(text)
    let slug = base
    while (this.seen.has(slug)) {
      const n = (this.seen.get(base) ?? 0) + 1
      this.seen.set(base, n)
      slug = `${base}-${n}`
    }
    this.seen.set(slug, 0)
    return slug
  }
}
