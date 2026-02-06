import { db } from './database'
import type { FavoritePost } from './types'

export const addFavorite = async (id: string) => {
  await db.favorites.put({ id, addedAt: Date.now() })
}

export const removeFavorite = async (id: string) => {
  await db.favorites.delete(id)
}

export const isFavorite = async (id: string) => {
  const item = await db.favorites.get(id)
  return !!item
}

export const getFavorites = async (limit?: number, offset?: number) => {
  let collection = db.favorites.orderBy('addedAt').reverse()
  if (offset) collection = collection.offset(offset)
  if (limit) collection = collection.limit(limit)
  return await collection.toArray()
}

export const getAllFavoritesIds = async () => {
  const items = await db.favorites.orderBy('addedAt').reverse().toArray()
  return items.map((item: FavoritePost) => item.id)
}
