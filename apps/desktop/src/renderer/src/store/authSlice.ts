import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { AuthSession, GraphMeProfile } from '@shared/authTypes'

export type AuthState = {
  session: AuthSession
  meProfile: GraphMeProfile | null
}

const signedOut: AuthSession = {
  signedIn: false,
  accountName: null,
  username: null,
  homeAccountId: null,
  userId: null,
}

const initialState: AuthState = {
  session: signedOut,
  meProfile: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionUpdated(state, action: PayloadAction<AuthSession>) {
      state.session = action.payload
      if (!action.payload.signedIn) {
        state.meProfile = null
      }
    },
    meProfileUpdated(state, action: PayloadAction<GraphMeProfile | null>) {
      state.meProfile = action.payload
    },
    authClearedExtras(state) {
      state.meProfile = null
    },
  },
})

export const { sessionUpdated, meProfileUpdated, authClearedExtras } = authSlice.actions
export const authReducer = authSlice.reducer
