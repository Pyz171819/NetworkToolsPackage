import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

function subscribe(channel, callback) {
  const listener = (_event, data) => callback(data)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

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
  onPingData: (callback) => subscribe('ping-data', callback),
  // 移除监听
  offPingData: () => {
    ipcRenderer.removeAllListeners('ping-data')
  },
  
  // 端口扫描
  portScan: (host, ports) => ipcRenderer.invoke('port-scan', { host, ports }),
  onScanData: (callback) => subscribe('scan-data', callback),
  onScanProgress: (callback) => subscribe('scan-progress', callback),
  offScanData: () => {
    ipcRenderer.removeAllListeners('scan-data')
    ipcRenderer.removeAllListeners('scan-progress')
  },
  
  // 路由追踪
  traceroute: (host) => ipcRenderer.invoke('traceroute', host),
  // 中止路由追踪
  abortTraceroute: () => ipcRenderer.invoke('abort-traceroute'),
  onTracerouteData: (callback) => subscribe('traceroute-data', callback),
  offTracerouteData: () => {
    ipcRenderer.removeAllListeners('traceroute-data')
  },
  
  // 局域网扫描
  lanScan: () => ipcRenderer.invoke('lan-scan'),
  onLanScanData: (callback) => subscribe('lan-scan-data', callback),
  onLanScanProgress: (callback) => subscribe('lan-scan-progress', callback),
  offLanScanData: () => {
    ipcRenderer.removeAllListeners('lan-scan-data')
    ipcRenderer.removeAllListeners('lan-scan-progress')
  },

  // TCP 终端
  connectTcpTerminal: (host, port) => ipcRenderer.invoke('tcp-terminal-connect', { host, port }),
  sendTcpTerminal: (text, newlineMode) =>
    ipcRenderer.invoke('tcp-terminal-send', { text, newlineMode }),
  disconnectTcpTerminal: () => ipcRenderer.invoke('tcp-terminal-disconnect'),
  onTcpTerminalData: (callback) => subscribe('tcp-terminal-data', callback),
  onTcpTerminalStatus: (callback) => subscribe('tcp-terminal-status', callback),

  // 脚本管理
  openScriptDialog: () => ipcRenderer.invoke('open-script-dialog'),
  runScript: (scriptPath) => ipcRenderer.invoke('run-script', scriptPath),
  sendScriptInput: (text) => ipcRenderer.invoke('send-script-input', text),
  stopScript: () => ipcRenderer.invoke('stop-script'),
  loadScripts: () => ipcRenderer.invoke('load-scripts'),
  saveScripts: (scripts) => ipcRenderer.invoke('save-scripts', scripts),
  onScriptOutput: (callback) => subscribe('script-output', callback),
  onScriptExit: (callback) => subscribe('script-exit', callback),
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
