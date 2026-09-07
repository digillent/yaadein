import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { MediaInspection } from '@shared/mediaTypes'
import type { AcceptUploadHarnessResult, CosmosHarnessResult } from '@shared/decisionTypes'

export type AppScreen =
  | 'home'
  | 'setup'
  | 'settings'
  | 'scan'
  | 'viewMedia'
  | 'tools'

export type UiState = {
  busy: boolean
  status: string
  screen: AppScreen
  settingsHydrated: boolean
  inspection: MediaInspection | null
  cosmosHarness: CosmosHarnessResult | null
  blobHarness: AcceptUploadHarnessResult | null
}

const initialState: UiState = {
  busy: false,
  status: '',
  screen: 'home',
  settingsHydrated: false,
  inspection: null,
  cosmosHarness: null,
  blobHarness: null,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    busySet(state, action: PayloadAction<boolean>) {
      state.busy = action.payload
    },
    statusSet(state, action: PayloadAction<string>) {
      state.status = action.payload
    },
    screenSet(state, action: PayloadAction<AppScreen>) {
      state.screen = action.payload
    },
    settingsHydratedSet(state, action: PayloadAction<boolean>) {
      state.settingsHydrated = action.payload
    },
    inspectionSet(state, action: PayloadAction<MediaInspection | null>) {
      state.inspection = action.payload
    },
    cosmosHarnessSet(state, action: PayloadAction<CosmosHarnessResult | null>) {
      state.cosmosHarness = action.payload
    },
    blobHarnessSet(state, action: PayloadAction<AcceptUploadHarnessResult | null>) {
      state.blobHarness = action.payload
    },
    harnessExtrasCleared(state) {
      state.cosmosHarness = null
      state.blobHarness = null
      state.inspection = null
    },
  },
})

export const {
  busySet,
  statusSet,
  screenSet,
  settingsHydratedSet,
  inspectionSet,
  cosmosHarnessSet,
  blobHarnessSet,
  harnessExtrasCleared,
} = uiSlice.actions
export const uiReducer = uiSlice.reducer
