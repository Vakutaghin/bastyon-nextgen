/**
 * Pinia Store для управления профилем пользователя
 * Выделен из auth-store для разделения ответственности.
 */

import { defineStore } from 'pinia'
import type { UserProfile, GetUserProfileResponse } from '../../types/rpc-responses/user-get'
import type { UserState as UserStateData, GetUserStateResponse } from '../../types/rpc-responses/user-state'
import type { Address } from '../types/addresses'

export const useProfileStore = defineStore('profile', {
  state: () => ({
    userProfile: null as UserProfile | UserStateData | null,
    userAvatarUrl: null as string | null,
    isFetchingUserState: false,
  }),

  getters: {
    getUserProfile(): UserProfile | UserStateData | null {
      return this.userProfile
    },

    getUserAvatarUrl(): string | null {
      if (this.userAvatarUrl) return this.userAvatarUrl
      const profile = this.userProfile
      if (profile && (profile as any).i) return (profile as any).i
      return null
    },

    getUserState(): UserStateData | null {
      const profile = this.userProfile
      if (profile && ('score_unspent' in profile || 'post_unspent' in profile)) {
        return profile as UserStateData
      }
      return null
    },

    hasUserState(): boolean {
      const profile = this.userProfile
      return !!(profile && ('score_unspent' in profile || 'post_unspent' in profile))
    },
  },

  actions: {
    /**
     * Загружает полное состояние пользователя через getuserstate + getuserprofile
     */
    async fetchUserState(address: Address | null): Promise<UserStateData | null> {
      if (!address) return null
      if (this.isFetchingUserState) return null

      // Если данные уже загружены для этого адреса, не делаем повторный запрос
      if (this.hasUserState) {
        const profile = this.userProfile
        if (profile && (profile as any).address === address) {
          return profile as UserStateData
        }
        this.userProfile = null
        this.userAvatarUrl = null
      }

      this.isFetchingUserState = true

      try {
        const { rpcEndpoints } = await import('../../helpers/api/rpc-endpoints')
        const { getByPRCWithAuth } = await import('../../helpers/api/request')

        const cachehash = Date.now().toString(36) + Math.random().toString(36).substring(2)

        const [stateResponse, profileResponse] = await Promise.all([
          getByPRCWithAuth({
            method: rpcEndpoints.getUserState,
            parameters: [[address]],
            cachehash,
            options: { auth: true },
          }) as Promise<GetUserStateResponse>,
          getByPRCWithAuth({
            method: rpcEndpoints.getUserProfile,
            parameters: [[address]],
            cachehash,
            options: { auth: true },
          }) as Promise<GetUserProfileResponse>,
        ])

        // Cache in Vue Query
        try {
          const { queryClient } = await import('../../query-client')
          if (stateResponse) queryClient.setQueryData(['user', 'state', address], stateResponse)
          if (profileResponse) queryClient.setQueryData(['user', 'current-profile', address], profileResponse)
        } catch { /* ignore cache errors */ }

        let userStateData: UserStateData | null = null
        let userProfileData: UserProfile | null = null

        // Extract state
        if (stateResponse.result === 'success' && stateResponse.data) {
          let stateArray: UserStateData[] = []
          if (Array.isArray(stateResponse.data)) {
            stateArray = stateResponse.data
          } else if (typeof stateResponse.data === 'object' && stateResponse.data !== null) {
            const dataObj = stateResponse.data as any
            if (dataObj.data && Array.isArray(dataObj.data)) stateArray = dataObj.data
            else if (dataObj.data && typeof dataObj.data === 'object') stateArray = [dataObj.data as UserStateData]
            else if (Object.keys(stateResponse.data).length > 0) stateArray = [stateResponse.data as UserStateData]
          }
          if (stateArray.length > 0) {
            userStateData = stateArray.find((item) => item?.address === address) || stateArray[0] || null
          }
        }

        // Extract profile
        if (profileResponse.result === 'success' && profileResponse.data && Array.isArray(profileResponse.data)) {
          userProfileData = profileResponse.data.find((item) => item?.address === address) || profileResponse.data[0] || null
        }

        // Merge
        const avatarFromProfile = userProfileData?.i
        const userState = {
          ...(userProfileData || {}),
          ...(userStateData || {}),
          ...(avatarFromProfile ? { i: avatarFromProfile } : {}),
          address,
        } as UserStateData

        if (!userState.i && userProfileData?.i) userState.i = userProfileData.i

        const avatarUrl = userState.i
        this.userProfile = { ...userState, i: avatarUrl } as UserProfile & UserStateData
        if (avatarUrl) this.userAvatarUrl = avatarUrl

        this.isFetchingUserState = false
        return userState
      } catch (error) {
        this.isFetchingUserState = false
        return null
      }
    },

    /**
     * Загружает профиль пользователя через getuserprofile
     */
    async fetchUserProfile(targetAddress: Address): Promise<UserProfile | null> {
      if (!targetAddress) return null

      try {
        const { getByPRCWithAuth } = await import('../../helpers/api/request')
        const { rpcEndpoints } = await import('../../helpers/api/rpc-endpoints')

        const response = await getByPRCWithAuth({
          method: rpcEndpoints.getUserProfile,
          parameters: [[targetAddress]],
          options: { auth: true },
        }) as GetUserProfileResponse

        try {
          const { queryClient } = await import('../../query-client')
          queryClient.setQueryData(['user', 'profile', targetAddress], response)
        } catch { /* ignore */ }

        let userProfile: UserProfile | null = null
        if (response?.result === 'success' && response.data && Array.isArray(response.data)) {
          userProfile = response.data.find((item) => item?.address === targetAddress) || response.data[0] || null
        } else if (response?.result === 'error') {
          throw new Error(response.error || 'Failed to fetch user profile')
        }

        if (!userProfile && response?.result === 'success') {
          userProfile = { address: targetAddress } as UserProfile
        }

        if (userProfile) {
          this.userProfile = userProfile
          return userProfile
        }

        return null
      } catch {
        return null
      }
    },

    clearProfile(): void {
      this.userProfile = null
      this.userAvatarUrl = null
      this.isFetchingUserState = false
    },
  },
})
