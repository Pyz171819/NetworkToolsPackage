import { ipcMain } from 'electron'
import os from 'os'
import net from 'net'
import { createCommandProcess, decodeCommandOutput, terminateChildProcess } from '../utils/command'
import {
  assertValidPortNumber,
  validateHostInput,
  validatePortListSize,
  validatePortScanPayload,
  validateTcpConnectPayload,
  validateTcpSendPayload
} from '../utils/validators'
import { getLanScanInterfaces, scanLocalNetwork } from '../services/lan-scan'

export function registerNetworkIpc() {
  let runningPing = null
  let previousCpuInfo = null
  let runningTraceroute = null
  let tcpSession = null

  ipcMain.handle('ping-target', (_event, ipAddress) => {
    const host = validateHostInput(ipAddress, 'Ping 目标')
    return new Promise((resolve) => {
      const childProcess = createCommandProcess(
        'ping',
        process.platform === 'win32' ? ['-n', '4', host] : ['-c', '4', host]
      )
      runningPing = childProcess
      let output = ''

      childProcess.stdout.on('data', (data) => {
        const text = decodeCommandOutput(data)
        output += text
        _event.sender.send('ping-data', text)
      })

      childProcess.stderr.on('data', (data) => {
        const text = decodeCommandOutput(data)
        output += text
        _event.sender.send('ping-data', text)
      })

      childProcess.on('close', () => {
        runningPing = null
        resolve(output)
      })

      childProcess.on('error', (error) => {
        runningPing = null
        resolve(`执行出错: ${error.message}`)
      })
    })
  })

  ipcMain.handle('quick-ping', (_event, host) => {
    const targetHost = validateHostInput(host, '延迟检测目标')
    return new Promise((resolve) => {
      const childProcess = createCommandProcess(
        'ping',
        process.platform === 'win32'
          ? ['-n', '1', '-w', '2000', targetHost]
          : ['-c', '1', '-W', '2', targetHost]
      )
      let output = ''

      childProcess.stdout.on('data', (data) => {
        output += decodeCommandOutput(data)
      })

      childProcess.stderr.on('data', (data) => {
        output += decodeCommandOutput(data)
      })

      childProcess.on('close', () => {
        resolve(output)
      })

      childProcess.on('error', () => {
        resolve(output)
      })

      setTimeout(() => {
        terminateChildProcess(childProcess)
      }, 5000)
    })
  })

  ipcMain.handle('abort-ping', () => {
    if (runningPing) {
      terminateChildProcess(runningPing)
      runningPing = null
      return { success: true }
    }
    return { success: false }
  })

  ipcMain.handle('get-local-network-info', () => {
    const networkInterfaces = os.networkInterfaces()

    let osName = os.type()
    const osRelease = os.release()

    if (osName === 'Windows_NT') {
      const version = osRelease.split('.')[2]
      osName = parseInt(version) >= 22000 ? 'Windows 11' : 'Windows 10'
    } else if (osName === 'Darwin') {
      osName = 'macOS'
    } else if (osName === 'Linux') {
      osName = 'Linux'
    }

    const displayOs = osName.startsWith('Windows') ? osName : `${osName} (${osRelease})`

    const info = {
      主机名: os.hostname(),
      操作系统: displayOs,
      系统架构: os.arch(),
      总内存: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`
    }

    for (const [name, interfaces] of Object.entries(networkInterfaces)) {
      const isWlanOrEthernet = name.includes('WLAN') || name.includes('以太网')
      if (!interfaces || !isWlanOrEthernet) continue

      interfaces.forEach((iface) => {
        if (iface.family === 'IPv4' && !iface.internal) {
          info[`${name} IPv4`] = iface.address
          info[`${name} MAC`] = iface.mac
        }
      })
    }

    return info
  })

  ipcMain.handle('get-system-stats', () => {
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem
    const memUsage = ((usedMem / totalMem) * 100).toFixed(1)

    const cpus = os.cpus()
    let totalIdle = 0
    let totalTick = 0

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type]
      }
      totalIdle += cpu.times.idle
    })

    let cpuUsage = 0
    if (previousCpuInfo) {
      const idleDiff = totalIdle - previousCpuInfo.idle
      const totalDiff = totalTick - previousCpuInfo.total
      cpuUsage = 100 - Math.floor((idleDiff / totalDiff) * 100)
    }

    previousCpuInfo = { idle: totalIdle, total: totalTick }

    return {
      cpuUsage: Math.max(0, Math.min(100, cpuUsage)),
      memUsage: parseFloat(memUsage),
      cpuCount: cpus.length,
      totalMem: (totalMem / 1024 / 1024 / 1024).toFixed(2),
      usedMem: (usedMem / 1024 / 1024 / 1024).toFixed(2)
    }
  })

  ipcMain.handle('port-scan', async (_event, { host, ports }) => {
    const { host: targetHost, portsText } = validatePortScanPayload({ host, ports })
    const portList = parsePortRange(portsText)
    validatePortListSize(portList)
    const results = []

    _event.sender.send(
      'scan-data',
      `[System] 开始扫描 ${targetHost}，共 ${portList.length} 个端口...\n\n`
    )

    for (let i = 0; i < portList.length; i++) {
      const port = portList[i]
      const isOpen = await checkPort(targetHost, port, 2000)
      const status = isOpen ? '开放' : '关闭'
      const color = isOpen ? '✓' : '✗'

      results.push({ port, isOpen })
      _event.sender.send('scan-data', `[${color}] 端口 ${port}: ${status}\n`)

      const progress = Math.round(((i + 1) / portList.length) * 100)
      _event.sender.send('scan-progress', { current: i + 1, total: portList.length, progress })
    }

    const openPorts = results.filter((result) => result.isOpen)
    _event.sender.send(
      'scan-data',
      `\n[Summary] 扫描完成！开放端口: ${openPorts.length}/${portList.length}\n`
    )

    return results
  })

  ipcMain.handle('traceroute', (_event, host) => {
    const targetHost = validateHostInput(host, '路由追踪目标')
    return new Promise((resolve) => {
      const childProcess = createCommandProcess(
        process.platform === 'win32' ? 'tracert' : 'traceroute',
        process.platform === 'win32' ? ['-h', '30', targetHost] : ['-m', '30', targetHost]
      )
      runningTraceroute = childProcess
      let output = ''

      childProcess.stdout.on('data', (data) => {
        const text = decodeCommandOutput(data)
        output += text
        _event.sender.send('traceroute-data', text)
      })

      childProcess.stderr.on('data', (data) => {
        const text = decodeCommandOutput(data)
        output += text
        _event.sender.send('traceroute-data', text)
      })

      childProcess.on('close', () => {
        runningTraceroute = null
        resolve(output)
      })

      childProcess.on('error', (error) => {
        runningTraceroute = null
        resolve(`执行出错: ${error.message}`)
      })
    })
  })

  ipcMain.handle('abort-traceroute', () => {
    if (runningTraceroute) {
      terminateChildProcess(runningTraceroute)
      runningTraceroute = null
      return { success: true }
    }
    return { success: false }
  })

  ipcMain.handle('get-lan-scan-interfaces', () => {
    return getLanScanInterfaces()
  })

  ipcMain.handle('lan-scan', async (_event, options) => {
    return scanLocalNetwork(_event.sender, options)
  })

  ipcMain.handle('tcp-terminal-connect', async (_event, payload) => {
    const { host, port } = validateTcpConnectPayload(payload)

    if (tcpSession?.connected) {
      throw new Error('已有 TCP 会话连接中，请先断开当前连接')
    }

    if (tcpSession?.socket && !tcpSession.socket.destroyed) {
      tcpSession.socket.destroy()
      tcpSession = null
    }

    return new Promise((resolve, reject) => {
      const socket = new net.Socket()
      const sender = _event.sender
      const connectStartedAt = Date.now()
      let settled = false

      const finish = (callback) => {
        if (settled) return
        settled = true
        callback()
      }

      const connectTimeout = setTimeout(() => {
        socket.destroy()
        finish(() => reject(new Error('TCP 连接超时')))
      }, 5000)

      tcpSession = {
        socket,
        sender,
        host,
        port,
        connected: false
      }

      socket.on('connect', () => {
        clearTimeout(connectTimeout)
        tcpSession.connected = true
        sender.send('tcp-terminal-status', {
          state: 'connected',
          host,
          port,
          durationMs: Date.now() - connectStartedAt
        })
        finish(() =>
          resolve({
            success: true,
            host,
            port,
            durationMs: Date.now() - connectStartedAt
          })
        )
      })

      socket.on('data', (data) => {
        sender.send('tcp-terminal-data', decodeCommandOutput(data))
      })

      socket.on('error', (error) => {
        clearTimeout(connectTimeout)
        sender.send('tcp-terminal-status', {
          state: 'error',
          message: error.message
        })
        if (!settled) {
          tcpSession = null
          finish(() => reject(new Error(`TCP 连接失败: ${error.message}`)))
        }
      })

      socket.on('close', (hadError) => {
        clearTimeout(connectTimeout)
        const wasConnected = tcpSession?.connected
        tcpSession = null
        sender.send('tcp-terminal-status', {
          state: 'disconnected',
          hadError,
          message: hadError ? 'TCP 连接异常断开' : 'TCP 连接已关闭'
        })
        if (!settled && !wasConnected) {
          finish(() => reject(new Error('TCP 连接已关闭')))
        }
      })

      socket.connect(port, host)
    })
  })

  ipcMain.handle('tcp-terminal-send', (_event, payload) => {
    const { text, newlineMode } = validateTcpSendPayload(payload)

    if (!tcpSession?.connected || !tcpSession.socket || tcpSession.socket.destroyed) {
      throw new Error('TCP 会话未连接')
    }

    const suffix = newlineMode === 'crlf' ? '\r\n' : newlineMode === 'lf' ? '\n' : ''
    tcpSession.socket.write(text + suffix)
    return { success: true }
  })

  ipcMain.handle('tcp-terminal-disconnect', () => {
    if (!tcpSession?.socket || tcpSession.socket.destroyed) {
      tcpSession = null
      return { success: false }
    }

    const socket = tcpSession.socket
    tcpSession = null
    socket.end()
    socket.destroy()
    return { success: true }
  })
}

function parsePortRange(portsStr) {
  const ports = []
  const parts = portsStr.split(',')

  parts.forEach((part) => {
    const value = part.trim()
    if (value.includes('-')) {
      const [start, end] = value.split('-').map((port) => parseInt(port.trim()))
      assertValidPortNumber(start, '起始端口')
      assertValidPortNumber(end, '结束端口')
      if (start > end) {
        throw new Error('端口范围起始值不能大于结束值')
      }
      for (let i = start; i <= end; i++) {
        if (i >= 1 && i <= 65535) ports.push(i)
      }
      return
    }

    const port = parseInt(value)
    assertValidPortNumber(port)
    ports.push(port)
  })

  return [...new Set(ports)].sort((a, b) => a - b)
}

function checkPort(host, port, timeout = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let isResolved = false

    socket.setTimeout(timeout)

    socket.on('connect', () => {
      if (isResolved) return
      isResolved = true
      socket.destroy()
      resolve(true)
    })

    socket.on('timeout', () => {
      if (isResolved) return
      isResolved = true
      socket.destroy()
      resolve(false)
    })

    socket.on('error', () => {
      if (isResolved) return
      isResolved = true
      resolve(false)
    })

    socket.connect(port, host)
  })
}
