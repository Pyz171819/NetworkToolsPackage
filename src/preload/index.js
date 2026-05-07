import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// 自定义我们要暴露给 Vue 的 API
const api = {
  // 暴露 pingTest 方法
  pingTest: (ip) => ipcRenderer.invoke('ping-target', ip),
  // 快速 ping（单包延迟检测）
  quickPing: (host) => ipcRenderer.invoke('quick-ping', host),
  // 中止 ping
  abortPing: () => ipcRenderer.invoke('abort-ping'),
  // 暴露获取本机网络信息方法
  getLocalNetworkInfo: () => ipcRenderer.invoke('get-local-network-info'),
  // 获取系统资源使用情况
  getSystemStats: () => ipcRenderer.invoke('get-system-stats'),
  // 监听实时 ping 数据
  onPingData: (callback) => {
    ipcRenderer.removeAllListeners('ping-data')
    ipcRenderer.on('ping-data', (_event, data) => callback(data))
  },
  // 移除监听
  offPingData: () => {
    ipcRenderer.removeAllListeners('ping-data')
  },
  
  // 端口扫描
  portScan: (host, ports) => ipcRenderer.invoke('port-scan', { host, ports }),
  onScanData: (callback) => {
    ipcRenderer.removeAllListeners('scan-data')
    ipcRenderer.on('scan-data', (_event, data) => callback(data))
  },
  onScanProgress: (callback) => {
    ipcRenderer.removeAllListeners('scan-progress')
    ipcRenderer.on('scan-progress', (_event, data) => callback(data))
  },
  offScanData: () => {
    ipcRenderer.removeAllListeners('scan-data')
    ipcRenderer.removeAllListeners('scan-progress')
  },
  
  // 路由追踪
  traceroute: (host) => ipcRenderer.invoke('traceroute', host),
  // 中止路由追踪
  abortTraceroute: () => ipcRenderer.invoke('abort-traceroute'),
  onTracerouteData: (callback) => {
    ipcRenderer.removeAllListeners('traceroute-data')
    ipcRenderer.on('traceroute-data', (_event, data) => callback(data))
  },
  offTracerouteData: () => {
    ipcRenderer.removeAllListeners('traceroute-data')
  },
  
  // 局域网扫描
  lanScan: () => ipcRenderer.invoke('lan-scan'),
  onLanScanData: (callback) => {
    ipcRenderer.removeAllListeners('lan-scan-data')
    ipcRenderer.on('lan-scan-data', (_event, data) => callback(data))
  },
  onLanScanProgress: (callback) => {
    ipcRenderer.removeAllListeners('lan-scan-progress')
    ipcRenderer.on('lan-scan-progress', (_event, data) => callback(data))
  },
  offLanScanData: () => {
    ipcRenderer.removeAllListeners('lan-scan-data')
    ipcRenderer.removeAllListeners('lan-scan-progress')
  },

  // 脚本管理
  openScriptDialog: () => ipcRenderer.invoke('open-script-dialog'),
  runScript: (scriptPath) => ipcRenderer.invoke('run-script', scriptPath),
  sendScriptInput: (text) => ipcRenderer.invoke('send-script-input', text),
  stopScript: () => ipcRenderer.invoke('stop-script'),
  loadScripts: () => ipcRenderer.invoke('load-scripts'),
  saveScripts: (scripts) => ipcRenderer.invoke('save-scripts', scripts),
  onScriptOutput: (callback) => {
    ipcRenderer.removeAllListeners('script-output')
    ipcRenderer.on('script-output', (_event, data) => callback(data))
  },
  onScriptExit: (callback) => {
    ipcRenderer.removeAllListeners('script-exit')
    ipcRenderer.on('script-exit', (_event, data) => callback(data))
  },
  offScriptEvents: () => {
    ipcRenderer.removeAllListeners('script-output')
    ipcRenderer.removeAllListeners('script-exit')
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    // 将 api 挂载到 window 对象上
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
