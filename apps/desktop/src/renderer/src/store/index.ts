import { configureStore } from '@reduxjs/toolkit'
import { authReducer } from './authSlice'
import { scanReducer } from './scanSlice'
import { reviewReducer } from './reviewSlice'
import { settingsReducer } from './settingsSlice'
import { uiReducer } from './uiSlice'

export function createAppStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      scan: scanReducer,
      review: reviewReducer,
      settings: settingsReducer,
      ui: uiReducer,
    },
  })
}

export const store = createAppStore()

export type AppStore = ReturnType<typeof createAppStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
