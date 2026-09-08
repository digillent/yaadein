import { describe, expect, it } from 'vitest'
import { createAppStore } from './index'
import { sessionUpdated } from './authSlice'
import { scanProgressUpdated, scanCompleted } from './scanSlice'
import {
  reviewQueueLoaded,
  reviewAdvanced,
  reviewIndexSet,
  reviewPreviewUpdated,
  selectCurrentReviewPath,
} from './reviewSlice'
import { workingRootSet, scanRootSet, eventDateOverrideSet } from './settingsSlice'
import { busySet, statusSet, screenSet, settingsHydratedSet } from './uiSlice'

describe('redux store slices', () => {
  it('tracks auth session sign-in and sign-out', () => {
    const store = createAppStore()
    store.dispatch(
      sessionUpdated({
        signedIn: true,
        accountName: 'Test',
        username: 't@example.com',
        homeAccountId: 'h',
        userId: 'oid',
      }),
    )
    expect(store.getState().auth.session.signedIn).toBe(true)
    store.dispatch(
      sessionUpdated({
        signedIn: false,
        accountName: null,
        username: null,
        homeAccountId: null,
        userId: null,
      }),
    )
    expect(store.getState().auth.session.signedIn).toBe(false)
    expect(store.getState().auth.meProfile).toBeNull()
  })

  it('stores settings for working/scan roots', () => {
    const store = createAppStore()
    store.dispatch(workingRootSet('/work'))
    store.dispatch(scanRootSet('/scan'))
    store.dispatch(eventDateOverrideSet('2026-01-02'))
    expect(store.getState().settings).toMatchObject({
      workingRoot: '/work',
      scanRoot: '/scan',
      eventDateOverride: '2026-01-02',
    })
  })

  it('tracks scan progress and result', () => {
    const store = createAppStore()
    store.dispatch(
      scanProgressUpdated({
        phase: 'hashing',
        filesFound: 3,
        filesProcessed: 1,
        movedRejected: 0,
        movedDuplicate: 0,
        skippedUnknown: 0,
        errors: 0,
      }),
    )
    expect(store.getState().scan.progress?.phase).toBe('hashing')
    store.dispatch(
      scanCompleted({
        filesFound: 3,
        movedRejected: 0,
        movedDuplicate: 1,
        skippedUnknown: 2,
        errors: 0,
        peerCandidateSizeCount: 1,
        results: [],
      }),
    )
    expect(store.getState().scan.lastResult?.movedDuplicate).toBe(1)
  })

  it('manages review queue advance and current path', () => {
    const store = createAppStore()
    store.dispatch(reviewQueueLoaded(['/a.jpg', '/b.jpg', '/c.jpg']))
    expect(selectCurrentReviewPath(store.getState())).toBe('/a.jpg')
    store.dispatch(
      reviewPreviewUpdated({
        sourcePath: '/a.jpg',
        mediaType: 'image/jpeg',
        kind: 'image',
        streamUrl: 'yaadein-media://local/?path=%2Fa.jpg',
        dataUrl: null,
      }),
    )
    const kept = store.getState().review.preview
    store.dispatch(reviewIndexSet(1))
    expect(selectCurrentReviewPath(store.getState())).toBe('/b.jpg')
    // Keep prior preview on nav so the stage does not blank between ←/→.
    expect(store.getState().review.preview).toEqual(kept)
    store.dispatch(reviewAdvanced())
    expect(store.getState().review.queue).toEqual(['/a.jpg', '/c.jpg'])
    expect(selectCurrentReviewPath(store.getState())).toBe('/c.jpg')
  })

  it('tracks busy and status for the shell', () => {
    const store = createAppStore()
    store.dispatch(busySet(true))
    store.dispatch(statusSet('Scanning…'))
    expect(store.getState().ui.busy).toBe(true)
    expect(store.getState().ui.status).toBe('Scanning…')
  })

  it('navigates app screens and marks settings hydrated', () => {
    const store = createAppStore()
    expect(store.getState().ui.screen).toBe('home')
    expect(store.getState().ui.settingsHydrated).toBe(false)
    store.dispatch(settingsHydratedSet(true))
    store.dispatch(screenSet('setup'))
    expect(store.getState().ui.settingsHydrated).toBe(true)
    expect(store.getState().ui.screen).toBe('setup')
    store.dispatch(screenSet('scan'))
    expect(store.getState().ui.screen).toBe('scan')
    store.dispatch(screenSet('viewMedia'))
    expect(store.getState().ui.screen).toBe('viewMedia')
    store.dispatch(screenSet('review'))
    expect(store.getState().ui.screen).toBe('review')
    store.dispatch(screenSet('rejected'))
    expect(store.getState().ui.screen).toBe('rejected')
    store.dispatch(screenSet('duplicates'))
    expect(store.getState().ui.screen).toBe('duplicates')
  })
})
