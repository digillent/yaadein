export { walkMediaFiles } from './walkMediaFiles'
export { scanAndClassify, SCAN_LOOKUP_BATCH_SIZE } from './scanAndClassify'
export type { ScanClassifyDeps, ScanDecisionLookup } from './scanAndClassify'
export {
  classifyExactDuplicate,
  groupByFileSize,
  peerCandidateSizes,
} from './exactDuplicates'
