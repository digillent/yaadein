import { contextBridge } from 'electron'
import { appName } from '../shared/appInfo'

contextBridge.exposeInMainWorld('yaadein', {
  appName,
})
