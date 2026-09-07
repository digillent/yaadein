import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { ScanClassifyResult, ScanProgress } from '@shared/scanTypes'

export type ScanState = {
  progress: ScanProgress | null
  lastResult: ScanClassifyResult | null
}

const initialState: ScanState = {
  progress: null,
  lastResult: null,
}

const scanSlice = createSlice({
  name: 'scan',
  initialState,
  reducers: {
    scanProgressUpdated(state, action: PayloadAction<ScanProgress>) {
      state.progress = action.payload
    },
    scanStarted(state) {
      state.lastResult = null
      state.progress = null
    },
    scanCompleted(state, action: PayloadAction<ScanClassifyResult>) {
      state.lastResult = action.payload
    },
    scanFailed(state) {
      state.lastResult = null
    },
  },
})

export const { scanProgressUpdated, scanStarted, scanCompleted, scanFailed } = scanSlice.actions
export const scanReducer = scanSlice.reducer
