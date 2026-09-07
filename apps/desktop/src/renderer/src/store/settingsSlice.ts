import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type WorkingBucket = 'preserve' | 'duplicate' | 'rejected'

export type SettingsState = {
  workingRoot: string
  scanRoot: string
  sourcePath: string
  moveBucket: WorkingBucket
  eventDateOverride: string
}

const initialState: SettingsState = {
  workingRoot: '',
  scanRoot: '',
  sourcePath: '',
  moveBucket: 'preserve',
  eventDateOverride: '',
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    workingRootSet(state, action: PayloadAction<string>) {
      state.workingRoot = action.payload
    },
    scanRootSet(state, action: PayloadAction<string>) {
      state.scanRoot = action.payload
    },
    sourcePathSet(state, action: PayloadAction<string>) {
      state.sourcePath = action.payload
    },
    moveBucketSet(state, action: PayloadAction<WorkingBucket>) {
      state.moveBucket = action.payload
    },
    eventDateOverrideSet(state, action: PayloadAction<string>) {
      state.eventDateOverride = action.payload
    },
  },
})

export const {
  workingRootSet,
  scanRootSet,
  sourcePathSet,
  moveBucketSet,
  eventDateOverrideSet,
} = settingsSlice.actions
export const settingsReducer = settingsSlice.reducer
