import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { MediaPreview } from '@shared/reviewTypes'

export type ReviewState = {
  queue: string[]
  index: number
  preview: MediaPreview | null
}

const initialState: ReviewState = {
  queue: [],
  index: 0,
  preview: null,
}

const reviewSlice = createSlice({
  name: 'review',
  initialState,
  reducers: {
    reviewQueueLoaded(state, action: PayloadAction<string[]>) {
      state.queue = action.payload
      state.index = 0
      state.preview = null
    },
    reviewIndexSet(state, action: PayloadAction<number>) {
      if (state.queue.length === 0) {
        state.index = 0
        return
      }
      const next = action.payload % state.queue.length
      state.index = next < 0 ? next + state.queue.length : next
    },
    reviewAdvanced(state) {
      const next = state.queue.filter((_, i) => i !== state.index)
      state.queue = next
      state.index = next.length === 0 ? 0 : Math.min(state.index, next.length - 1)
      state.preview = null
    },
    reviewPreviewUpdated(state, action: PayloadAction<MediaPreview | null>) {
      state.preview = action.payload
    },
  },
})

export const { reviewQueueLoaded, reviewIndexSet, reviewAdvanced, reviewPreviewUpdated } =
  reviewSlice.actions
export const reviewReducer = reviewSlice.reducer

export function selectCurrentReviewPath(state: { review: ReviewState }): string | null {
  return state.review.queue[state.review.index] ?? null
}
