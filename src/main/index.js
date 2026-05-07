import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, dirname } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { exec, spawn } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import os from 'os'
import net from 'net'

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 680,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      // 禁用缓存以避免权限警告
      cache: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // 禁用GPU缓存以避免权限警告
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
  
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 核心！监听前端的 ping 指令并执行
  let runningPing = null

  ipcMain.handle('ping-target', (_event, ipAddress) => {
    return new Promise((resolve) => {
      const command = process.platform === 'win32'
        ? `chcp 65001 && ping -n 4 ${ipAddress}`
        : `ping -c 4 ${ipAddress}`

      const childProcess = exec(command)
      runningPing = childProcess
      let output = ''

      childProcess.stdout.on('data', (data) => {
        const cleanData = data.toString().replace(/Active code page: 65001\r\n/g, '')
        output += cleanData
        _event.sender.send('ping-data', cleanData)
      })

      childProcess.stderr.on('data', (data) => {
        const errorData = data.toString()
        output += errorData
        _event.sender.send('ping-data', errorData)
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

  // 快速 ping（单包，用于延迟检测）
  ipcMain.handle('quick-ping', (_event, host) => {
    return new Promise((resolve) => {
      const isWindows = process.platform === 'win32'
      const command = isWindows
        ? `chcp 65001 && ping -n 1 -w 2000 ${host}`
        : `ping -c 1 -W 2 ${host}`

      exec(command, { timeout: 5000 }, (error, stdout) => {
        const output = (stdout || '').replace(/Active code page: 65001\r\n/g, '')
        resolve(output)
      })
    })
  })

  // 中止 ping
  ipcMain.handle('abort-ping', () => {
    if (runningPing) {
      if (process.platform === 'win32') {
        exec(`taskkill /F /T /PID ${runningPing.pid}`)
      } else {
        runningPing.kill('SIGTERM')
      }
      runningPing = null
      return { success: true }
    }
    return { success: false }
  })

  // 获取本机网络信息
  ipcMain.handle('get-local-network-info', () => {
    const networkInterfaces = os.networkInterfaces()
    
    // 优化操作系统显示
    let osName = os.type()
    const osRelease = os.release()
    
    if (osName === 'Windows_NT') {
      const version = osRelease.split('.')[2]
      if (parseInt(version) >= 22000) {
        osName = 'Windows 11'
      } else {
        osName = 'Windows 10'
      }
    } else if (osName === 'Darwin') {
      osName = 'macOS'
    } else if (osName === 'Linux') {
      osName = 'Linux'
    }
    
    const info = {
      '主机名': os.hostname(),
      '操作系统': `${osName} (${osRelease})`,
      '系统架构': os.arch(),
      '总内存': `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
    }

    // 只检测 WLAN 和以太网接口
    for (const [name, interfaces] of Object.entries(networkInterfaces)) {
      // 过滤：只要包含 WLAN、以太网、Ethernet、Wi-Fi 的接口
      const isWlanOrEthernet = 
        name.includes('WLAN') || 
        name.includes('以太网')
      
      if (interfaces && isWlanOrEthernet) {
        interfaces.forEach((iface) => {
          if (iface.family === 'IPv4' && !iface.internal) {
            info[`${name} IPv4`] = iface.address
            info[`${name} MAC`] = iface.mac
          }
        })
      }
    }

    return info
  })

  // 获取系统资源使用情况
  let previousCpuInfo = null
  
  ipcMain.handle('get-system-stats', () => {
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem
    const memUsage = ((usedMem / totalMem) * 100).toFixed(1)
    
    // 计算 CPU 使用率
    const cpus = os.cpus()
    let totalIdle = 0
    let totalTick = 0
    
    cpus.forEach(cpu => {
      for (let type in cpu.times) {
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
    
    previousCpuInfo = {
      idle: totalIdle,
      total: totalTick
    }
    
    return {
      cpuUsage: Math.max(0, Math.min(100, cpuUsage)),
      memUsage: parseFloat(memUsage),
      cpuCount: cpus.length,
      totalMem: (totalMem / 1024 / 1024 / 1024).toFixed(2),
      usedMem: (usedMem / 1024 / 1024 / 1024).toFixed(2)
    }
  })

  // 端口扫描功能
  ipcMain.handle('port-scan', async (_event, { host, ports }) => {
    const portList = parsePortRange(ports)
    const results = []
    
    _event.sender.send('scan-data', `[System] 开始扫描 ${host}，共 ${portList.length} 个端口...\n\n`)
    
    for (let i = 0; i < portList.length; i++) {
      const port = portList[i]
      const isOpen = await checkPort(host, port, 2000)
      const status = isOpen ? '开放' : '关闭'
      const color = isOpen ? '✓' : '✗'
      
      results.push({ port, isOpen })
      
      // 实时发送扫描结果
      _event.sender.send('scan-data', `[${color}] 端口 ${port}: ${status}\n`)
      
      // 发送进度
      const progress = Math.round(((i + 1) / portList.length) * 100)
      _event.sender.send('scan-progress', { current: i + 1, total: portList.length, progress })
    }
    
    const openPorts = results.filter(r => r.isOpen)
    _event.sender.send('scan-data', `\n[Summary] 扫描完成！开放端口: ${openPorts.length}/${portList.length}\n`)
    
    return results
  })

  // 路由追踪功能
  let runningTraceroute = null

  ipcMain.handle('traceroute', (_event, host) => {
    return new Promise((resolve) => {
      const command = process.platform === 'win32'
        ? `chcp 65001 && tracert -h 30 ${host}`
        : `traceroute -m 30 ${host}`

      const childProcess = exec(command)
      runningTraceroute = childProcess
      let output = ''

      childProcess.stdout.on('data', (data) => {
        const cleanData = data.toString().replace(/Active code page: 65001\r\n/g, '')
        output += cleanData
        _event.sender.send('traceroute-data', cleanData)
      })

      childProcess.stderr.on('data', (data) => {
        const errorData = data.toString()
        output += errorData
        _event.sender.send('traceroute-data', errorData)
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

  // 中止路由追踪
  ipcMain.handle('abort-traceroute', () => {
    if (runningTraceroute) {
      if (process.platform === 'win32') {
        exec(`taskkill /F /T /PID ${runningTraceroute.pid}`)
      } else {
        runningTraceroute.kill('SIGTERM')
      }
      runningTraceroute = null
      return { success: true }
    }
    return { success: false }
  })

  // 局域网扫描功能
  ipcMain.handle('lan-scan', async (_event) => {
    const networkInterfaces = os.networkInterfaces()
    let localIp = null
    let subnet = null
    let selectedInterface = null

    // 辅助函数：判断是否为虚拟网卡
    const isVirtualInterface = (name, address) => {
      const virtualPatterns = [
        'vEthernet',
        'VMware',
        'VirtualBox',
        'Hyper-V',
        'WSL',
        'Docker',
        'vboxnet',
        'vmnet'
      ]
      
      // 检查接口名称
      for (const pattern of virtualPatterns) {
        if (name.includes(pattern)) return true
      }
      
      // 检查IP地址范围（虚拟网卡常用的IP段）
      if (address.startsWith('172.') || address.startsWith('10.')) {
        // 172.16.0.0 - 172.31.255.255 是私有地址，但也可能是虚拟网卡
        // 需要进一步判断
        const parts = address.split('.')
        const second = parseInt(parts[1])
        // 172.16-31 是标准私有地址，但 172.25 很可能是虚拟网卡
        if (address.startsWith('172.') && (second < 16 || second > 31)) {
          return true
        }
      }
      
      return false
    }

    // 辅助函数：判断是否为物理网卡
    const isPhysicalInterface = (name) => {
      const physicalPatterns = [
        'WLAN',
        '以太网',
      ]
      
      for (const pattern of physicalPatterns) {
        if (name.includes(pattern)) return true
      }
      
      return false
    }

    // 第一步：优先查找物理网卡（192.168.x.x 网段）
    for (const [name, interfaces] of Object.entries(networkInterfaces)) {
      if (interfaces) {
        for (const iface of interfaces) {
          if (iface.family === 'IPv4' && !iface.internal) {
            // 优先选择 192.168.x.x 网段的物理网卡
            if (iface.address.startsWith('192.168.') && 
                isPhysicalInterface(name) && 
                !isVirtualInterface(name, iface.address)) {
              localIp = iface.address
              subnet = localIp.substring(0, localIp.lastIndexOf('.'))
              selectedInterface = name
              break
            }
          }
        }
      }
      if (subnet) break
    }

    // 第二步：如果没找到，查找任何物理网卡
    if (!subnet) {
      for (const [name, interfaces] of Object.entries(networkInterfaces)) {
        if (interfaces) {
          for (const iface of interfaces) {
            if (iface.family === 'IPv4' && !iface.internal) {
              if (isPhysicalInterface(name) && !isVirtualInterface(name, iface.address)) {
                localIp = iface.address
                subnet = localIp.substring(0, localIp.lastIndexOf('.'))
                selectedInterface = name
                break
              }
            }
          }
        }
        if (subnet) break
      }
    }

    // 第三步：如果还没找到，使用第一个非虚拟的IPv4接口
    if (!subnet) {
      for (const [name, interfaces] of Object.entries(networkInterfaces)) {
        if (interfaces) {
          for (const iface of interfaces) {
            if (iface.family === 'IPv4' && !iface.internal && !isVirtualInterface(name, iface.address)) {
              localIp = iface.address
              subnet = localIp.substring(0, localIp.lastIndexOf('.'))
              selectedInterface = name
              break
            }
          }
        }
        if (subnet) break
      }
    }

    if (!subnet) {
      _event.sender.send('lan-scan-data', '[Error] 未找到有效的网络接口\n')
      _event.sender.send('lan-scan-data', '[Debug] 可用接口列表:\n')
      for (const [name, interfaces] of Object.entries(networkInterfaces)) {
        if (interfaces) {
          interfaces.forEach(iface => {
            if (iface.family === 'IPv4') {
              const isVirtual = isVirtualInterface(name, iface.address) ? ' (虚拟)' : ''
              _event.sender.send('lan-scan-data', `  - ${name}: ${iface.address}${isVirtual}\n`)
            }
          })
        }
      }
      return []
    }

    // 输出所有接口的详细筛选信息
    _event.sender.send('lan-scan-data', '[Debug] 所有网络接口筛选详情:\n')
    for (const [name, interfaces] of Object.entries(networkInterfaces)) {
      if (interfaces) {
        interfaces.forEach(iface => {
          if (iface.family === 'IPv4' && !iface.internal) {
            const isVirtual = isVirtualInterface(name, iface.address)
            const isPhysical = isPhysicalInterface(name)
            _event.sender.send('lan-scan-data', `  ${name}: ${iface.address} | 虚拟:${isVirtual} | 物理:${isPhysical}\n`)
          }
        })
      }
    }

    _event.sender.send('lan-scan-data', `[Debug] 最终选择: ${selectedInterface}\n`)
    _event.sender.send('lan-scan-data', `[System] 检测到本机IP: ${localIp}\n`)
    _event.sender.send('lan-scan-data', `[System] 开始扫描网段: ${subnet}.0/24\n\n`)

    const devices = []
    const aliveIPs = []
    const batchSize = 20 // 每批扫描 20 个 IP
    
    // 第一阶段：快速扫描在线设备
    for (let start = 1; start <= 254; start += batchSize) {
      const end = Math.min(start + batchSize - 1, 254)
      const batchPromises = []
      
      for (let i = start; i <= end; i++) {
        const ip = `${subnet}.${i}`
        
        batchPromises.push(
          checkHost(ip, 2000).then(isAlive => {
            if (isAlive) {
              aliveIPs.push(ip)
            }
            
            // 发送进度
            const progress = Math.round((i / 254) * 100)
            _event.sender.send('lan-scan-progress', { current: i, total: 254, progress })
          })
        )
      }
      
      await Promise.all(batchPromises)
    }
    
    _event.sender.send('lan-scan-data', `\n[System] 发现 ${aliveIPs.length} 个在线设备，正在获取详细信息...\n\n`)
    
    // 第二阶段：批量获取详细信息（控制并发）
    const detailBatchSize = 5 // 每次只处理 5 个设备
    for (let i = 0; i < aliveIPs.length; i += detailBatchSize) {
      const batch = aliveIPs.slice(i, i + detailBatchSize)
      
      await Promise.all(
        batch.map(async (ip, index) => {
          const deviceNum = i + index + 1
          try {
            const deviceInfo = await Promise.race([
              getDeviceInfo(ip),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 3000)
              )
            ])
            
            devices.push(deviceInfo)
            
            // 单行显示所有信息
            let line = `[${deviceNum}] ${ip}`
            
            // MAC 和厂商
            if (deviceInfo.mac) {
              line += ` | MAC: ${deviceInfo.mac}`
              if (deviceInfo.vendor) line += ` (${deviceInfo.vendor})`
            }
            
            // 主机名
            if (deviceInfo.hostname) {
              line += ` | ${deviceInfo.hostname}`
            }
            
            // 设备类型
            line += ` | ${deviceInfo.deviceType}`
            
            // 开放端口
            if (deviceInfo.openPorts.length > 0) {
              line += ` | 端口: ${deviceInfo.openPorts.join(',')}`
            }
            
            _event.sender.send('lan-scan-data', line + '\n')
          } catch (error) {
            _event.sender.send('lan-scan-data', `[${deviceNum}] ${ip} | ❓ 获取详细信息超时\n`)
          }
        })
      )
    }
    
    _event.sender.send('lan-scan-data', `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
    _event.sender.send('lan-scan-data', `[Summary] 扫描完成！\n`)
    _event.sender.send('lan-scan-data', `  - 扫描网段: ${subnet}.0/24\n`)
    _event.sender.send('lan-scan-data', `  - 在线设备: ${aliveIPs.length} 个\n`)
    _event.sender.send('lan-scan-data', `  - 详细信息: ${devices.length} 个\n`)
    _event.sender.send('lan-scan-data', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
    
    return devices
  })

  // ==================== 脚本管理 ====================

  // 脚本元数据文件路径
  const getScriptsPath = () => join(app.getPath('userData'), 'scripts.json')

  // 打开文件选择对话框
  ipcMain.handle('open-script-dialog', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择脚本文件',
      filters: [
        { name: '脚本文件', extensions: ['bat', 'py', 'sh'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // 运行脚本 — 打开真正的 cmd 窗口执行
  let runningScript = null

  ipcMain.handle('run-script', async (_event, scriptPath) => {
    const ext = scriptPath.split('.').pop().toLowerCase()
    const isWindows = process.platform === 'win32'
    const startTime = Date.now()

    if (ext === 'bat') {
      // .bat 文件：用 shell.openItem 打开，等同于双击文件
      try {
        await shell.openPath(scriptPath)
        _event.sender.send('script-output', `[System] 已启动: ${scriptPath}\n`)
        _event.sender.send('script-output', `[System] 脚本在新窗口中运行\n\n`)
        _event.sender.send('script-exit', { code: 0, duration: '0' })
        return { success: true }
      } catch (err) {
        _event.sender.send('script-output', `\n[Error] 执行失败: ${err.message}\n`)
        return { success: false }
      }
    }

    // .py / .sh：继续用 pipe 方式捕获输出
    let command, args
    if (ext === 'py') {
      command = 'python'
      args = ['-u', scriptPath]
    } else if (ext === 'sh') {
      command = 'bash'
      args = [scriptPath]
    } else {
      _event.sender.send('script-output', `[Error] 不支持的脚本类型: .${ext}\n`)
      return { success: false }
    }

    // .py 设了 PYTHONIOENCODING=utf-8，.sh 本身就是 UTF-8
    const decoder = null

    try {
      const child = spawn(command, args, {
        cwd: dirname(scriptPath),
        shell: isWindows,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      })

      runningScript = child

      _event.sender.send('script-output', `[System] 开始执行: ${scriptPath}\n`)
      _event.sender.send('script-output', `[System] PID: ${child.pid}\n\n`)

      child.stdout.on('data', (buf) => {
        const text = decoder ? decoder.decode(buf, { stream: true }) : buf.toString('utf-8')
        _event.sender.send('script-output', text)
      })

      child.stderr.on('data', (buf) => {
        const text = decoder ? decoder.decode(buf, { stream: true }) : buf.toString('utf-8')
        _event.sender.send('script-output', text)
      })

      child.on('close', (code) => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1)
        _event.sender.send('script-output', `\n[System] 执行完毕，退出码: ${code}，耗时: ${duration}s\n`)
        _event.sender.send('script-exit', { code, duration })
        runningScript = null
      })

      child.on('error', (err) => {
        _event.sender.send('script-output', `\n[Error] 执行失败: ${err.message}\n`)
        _event.sender.send('script-exit', { code: -1, duration: '0' })
        runningScript = null
      })

      return { success: true, pid: child.pid }
    } catch (err) {
      _event.sender.send('script-output', `\n[Error] 执行失败: ${err.message}\n`)
      _event.sender.send('script-exit', { code: -1, duration: '0' })
      return { success: false }
    }
  })

  // 发送输入到脚本 stdin（仅 .py/.sh 有效）
  ipcMain.handle('send-script-input', (_event, text) => {
    if (runningScript && runningScript.stdin && !runningScript.stdin.destroyed) {
      runningScript.stdin.write(text + '\n')
      return { success: true }
    }
    return { success: false }
  })

  // 停止脚本
  ipcMain.handle('stop-script', () => {
    if (runningScript) {
      runningScript.kill()
      runningScript = null
      return { success: true }
    }
    return { success: false }
  })

  // 加载脚本列表
  ipcMain.handle('load-scripts', () => {
    const path = getScriptsPath()
    if (!existsSync(path)) return []
    try {
      return JSON.parse(readFileSync(path, 'utf-8'))
    } catch {
      return []
    }
  })

  // 保存脚本列表
  ipcMain.handle('save-scripts', (_event, scripts) => {
    try {
      writeFileSync(getScriptsPath(), JSON.stringify(scripts, null, 2), 'utf-8')
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 辅助函数：解析端口范围
function parsePortRange(portsStr) {
  const ports = []
  const parts = portsStr.split(',')
  
  parts.forEach(part => {
    part = part.trim()
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(p => parseInt(p.trim()))
      for (let i = start; i <= end; i++) {
        if (i >= 1 && i <= 65535) ports.push(i)
      }
    } else {
      const port = parseInt(part)
      if (port >= 1 && port <= 65535) ports.push(port)
    }
  })
  
  return [...new Set(ports)].sort((a, b) => a - b)
}

// 辅助函数：检查端口是否开放
function checkPort(host, port, timeout = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let isResolved = false

    socket.setTimeout(timeout)
    
    socket.on('connect', () => {
      if (!isResolved) {
        isResolved = true
        socket.destroy()
        resolve(true)
      }
    })

    socket.on('timeout', () => {
      if (!isResolved) {
        isResolved = true
        socket.destroy()
        resolve(false)
      }
    })

    socket.on('error', () => {
      if (!isResolved) {
        isResolved = true
        resolve(false)
      }
    })

    socket.connect(port, host)
  })
}

// 辅助函数：获取设备详细信息（快速版本）
async function getDeviceInfo(host) {
  const info = {
    ip: host,
    mac: null,
    hostname: null,
    openPorts: [],
    deviceType: '❓ 未知设备',
    vendor: null
  }

  try {
    // 并发执行所有查询，设置总超时
    const timeout = 2000 // 每个设备最多 2 秒
    const startTime = Date.now()
    
    // 1. 获取 MAC 地址
    const macPromise = new Promise((resolve) => {
      exec(`arp -a ${host}`, { timeout: 800 }, (error, stdout) => {
        if (!error && stdout) {
          const macMatch = stdout.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/)
          if (macMatch) {
            const mac = macMatch[0].toUpperCase().replace(/-/g, ':')
            resolve({ mac, vendor: getVendorByMac(mac) })
            return
          }
        }
        resolve({ mac: null, vendor: null })
      })
      setTimeout(() => resolve({ mac: null, vendor: null }), 800)
    })

    // 2. 获取主机名（仅 Windows）
    const hostnamePromise = process.platform === 'win32' 
      ? new Promise((resolve) => {
          exec(`nbtstat -A ${host}`, { timeout: 800 }, (error, stdout) => {
            if (!error && stdout) {
              const lines = stdout.split('\n')
              for (const line of lines) {
                const match = line.match(/^\s*([A-Z0-9\-_]+)\s+<00>\s+UNIQUE/i)
                if (match) {
                  resolve(match[1].trim())
                  return
                }
              }
            }
            resolve(null)
          })
          setTimeout(() => resolve(null), 800)
        })
      : Promise.resolve(null)

    // 3. 快速端口扫描（只扫描最关键的 3 个端口）
    const portsToScan = [80, 445, 22]
    const portPromise = Promise.all(
      portsToScan.map(port => 
        checkPort(host, port, 200).then(isOpen => ({ port, isOpen }))
      )
    )

    // 并发执行所有查询
    const [macResult, hostname, portResults] = await Promise.race([
      Promise.all([macPromise, hostnamePromise, portPromise]),
      new Promise((resolve) => setTimeout(() => resolve([{ mac: null, vendor: null }, null, []]), timeout))
    ])

    info.mac = macResult.mac
    info.vendor = macResult.vendor
    info.hostname = hostname
    info.openPorts = portResults.filter(r => r.isOpen).map(r => r.port)
    info.deviceType = guessDeviceType(info.openPorts, info.hostname, host)

    console.log(`[LAN Scan] Device info for ${host} took ${Date.now() - startTime}ms`)
  } catch (error) {
    console.error(`[LAN Scan] Error getting info for ${host}:`, error)
  }

  return info
}

// 辅助函数：根据 MAC 地址前缀识别厂商
function getVendorByMac(mac) {
  const prefix = mac.substring(0, 8).toUpperCase()
  const vendors = {
    '00:50:56': 'VMware',
    '00:0C:29': 'VMware',
    '00:05:69': 'VMware',
    '08:00:27': 'VirtualBox',
    '00:15:5D': 'Microsoft Hyper-V',
    '00:1C:42': 'Parallels',
    'DC:A6:32': 'Raspberry Pi',
    'B8:27:EB': 'Raspberry Pi',
    'E4:5F:01': 'Raspberry Pi',
    '28:CD:C1': 'Raspberry Pi',
    '34:97:F6': 'Xiaomi',
    '64:09:80': 'Xiaomi',
    'F8:8F:CA': 'Xiaomi',
    '50:8F:4C': 'Xiaomi',
    '78:11:DC': 'Xiaomi',
    'AC:23:3F': 'Xiaomi',
    '40:31:3C': 'Apple',
    '00:03:93': 'Apple',
    '00:1B:63': 'Apple',
    '00:1E:C2': 'Apple',
    '00:1F:5B': 'Apple',
    '00:21:E9': 'Apple',
    '00:23:12': 'Apple',
    '00:23:32': 'Apple',
    '00:23:6C': 'Apple',
    '00:23:DF': 'Apple',
    '00:24:36': 'Apple',
    '00:25:00': 'Apple',
    '00:25:4B': 'Apple',
    '00:25:BC': 'Apple',
    '00:26:08': 'Apple',
    '00:26:4A': 'Apple',
    '00:26:B0': 'Apple',
    '00:26:BB': 'Apple',
    '48:D7:05': 'Huawei',
    '00:E0:FC': 'Huawei',
    '70:72:3C': 'Huawei',
    'AC:85:3D': 'Huawei',
    '00:18:82': 'Huawei',
    '28:6E:D4': 'Huawei',
    '00:50:F2': 'Microsoft',
    '00:15:5D': 'Microsoft',
    '00:03:FF': 'Microsoft'
  }
  
  return vendors[prefix] || null
}

// 辅助函数：推测设备类型
function guessDeviceType(openPorts, hostname, ip) {
  const portSet = new Set(openPorts)
  
  // 路由器/网关（通常是 .1）
  if (ip.endsWith('.1') && (portSet.has(80) || portSet.has(443))) {
    return '🌐 路由器/网关'
  }
  
  // Windows 电脑
  if (portSet.has(445) || portSet.has(3389)) {
    return '💻 Windows 电脑'
  }
  
  // Linux 服务器
  if (portSet.has(22) && !portSet.has(445)) {
    return '🖥️ Linux 服务器'
  }
  
  // Web 服务器
  if ((portSet.has(80) || portSet.has(443) || portSet.has(8080)) && !portSet.has(445)) {
    return '🌍 Web 服务器'
  }
  
  // 数据库服务器
  if (portSet.has(3306) || portSet.has(5432)) {
    return '🗄️ 数据库服务器'
  }
  
  // 打印机
  if (portSet.has(9100) || (hostname && hostname.toLowerCase().includes('printer'))) {
    return '🖨️ 打印机'
  }
  
  // 移动设备（通常没有开放端口或只有少量端口）
  if (openPorts.length === 0 || openPorts.length <= 2) {
    return '📱 移动设备'
  }
  
  return '❓ 未知设备'
}

// 辅助函数：检查主机是否在线（优先使用 ping，失败则尝试端口）
async function checkHost(host, timeout = 2000) {
  // 方法1：尝试使用 ping
  try {
    const pingResult = await new Promise((resolve) => {
      const isWindows = process.platform === 'win32'
      const pingCmd = isWindows ? `ping -n 1 -w ${timeout} ${host}` : `ping -c 1 -W ${Math.floor(timeout/1000)} ${host}`
      
      exec(pingCmd, (error, stdout) => {
        if (error) {
          resolve(false)
        } else {
          // Windows: 检查 "TTL="，Linux/Mac: 检查 "ttl="
          resolve(stdout.toLowerCase().includes('ttl='))
        }
      })
      
      // 超时保护
      setTimeout(() => resolve(false), timeout + 500)
    })
    
    if (pingResult) return true
  } catch (e) {
    // ping 失败，继续尝试端口检测
  }

  // 方法2：端口检测（按优先级依次尝试，而不是并发）
  const commonPorts = [445, 80, 443, 22, 3389, 139, 8080]
  
  for (const port of commonPorts) {
    const isOpen = await checkPort(host, port, 800)
    if (isOpen) return true
  }
  
  return false
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
