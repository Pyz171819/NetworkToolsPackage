import os from 'os'
import net from 'net'
import { runCommand } from '../utils/command'

const MAX_SCAN_HOSTS = 4096

export function getLanScanInterfaces() {
  return buildNetworkTargets().map((target) => ({
    id: target.id,
    name: target.name,
    address: target.address,
    netmask: target.netmask,
    mac: target.mac,
    cidr: target.cidr,
    networkAddress: target.networkAddress,
    broadcastAddress: target.broadcastAddress,
    firstHost: target.firstHost,
    lastHost: target.lastHost,
    hostCount: target.hostCount,
    isVirtual: target.isVirtual,
    isPhysical: target.isPhysical,
    isPreferred: target.isPreferred
  }))
}

export async function scanLocalNetwork(sender, options = {}) {
  const targets = buildNetworkTargets()
  const selectedTarget = selectNetworkTarget(targets, options?.interfaceId)

  if (!selectedTarget) {
    sender.send('lan-scan-data', '[Error] 未找到有效的 IPv4 网络接口\n')
    return []
  }

  if (selectedTarget.hostCount > MAX_SCAN_HOSTS) {
    sender.send(
      'lan-scan-data',
      `[Error] 当前网段 ${selectedTarget.cidr} 包含 ${selectedTarget.hostCount} 个可扫描地址，超过单次上限 ${MAX_SCAN_HOSTS}。\n`
    )
    sender.send('lan-scan-data', '[Hint] 请选择更小的网段，或后续增加自定义扫描范围后再扫描。\n')
    return []
  }

  const scanHosts = getScanHosts(selectedTarget)
  if (scanHosts.length === 0) {
    sender.send('lan-scan-data', `[Error] 网段 ${selectedTarget.cidr} 没有可扫描地址\n`)
    return []
  }

  sender.send('lan-scan-data', `[System] 使用网卡: ${selectedTarget.name}\n`)
  sender.send('lan-scan-data', `[System] 本机 IPv4: ${selectedTarget.address}\n`)
  sender.send('lan-scan-data', `[System] 子网掩码: ${selectedTarget.netmask}\n`)
  sender.send('lan-scan-data', `[System] 扫描网段: ${selectedTarget.cidr}\n`)
  sender.send(
    'lan-scan-data',
    `[System] 地址范围: ${selectedTarget.firstHost} - ${selectedTarget.lastHost}，共 ${scanHosts.length} 个地址\n\n`
  )

  const devices = []
  const aliveIPs = []
  const batchSize = 32
  let checkedCount = 0

  for (let start = 0; start < scanHosts.length; start += batchSize) {
    const batch = scanHosts.slice(start, start + batchSize)

    await Promise.all(
      batch.map((ip) =>
        checkHost(ip, 2000).then((isAlive) => {
          if (isAlive) aliveIPs.push(ip)

          checkedCount++
          const progress = Math.round((checkedCount / scanHosts.length) * 100)
          sender.send('lan-scan-progress', {
            current: checkedCount,
            total: scanHosts.length,
            progress
          })
        })
      )
    )
  }

  sender.send(
    'lan-scan-data',
    `\n[System] 发现 ${aliveIPs.length} 个在线设备，正在获取详细信息...\n\n`
  )

  const detailBatchSize = 5
  for (let i = 0; i < aliveIPs.length; i += detailBatchSize) {
    const batch = aliveIPs.slice(i, i + detailBatchSize)

    await Promise.all(
      batch.map(async (ip, index) => {
        const deviceNum = i + index + 1
        try {
          const deviceInfo = await Promise.race([
            getDeviceInfo(ip),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
          ])

          devices.push(deviceInfo)
          let line = `[${deviceNum}] ${ip}`

          if (deviceInfo.mac) {
            line += ` | MAC: ${deviceInfo.mac}`
            if (deviceInfo.vendor) line += ` (${deviceInfo.vendor})`
          }

          if (deviceInfo.hostname) {
            line += ` | ${deviceInfo.hostname}`
          }

          line += ` | ${deviceInfo.deviceType}`

          if (deviceInfo.openPorts.length > 0) {
            line += ` | 端口: ${deviceInfo.openPorts.join(',')}`
          }

          sender.send('lan-scan-data', line + '\n')
        } catch {
          sender.send('lan-scan-data', `[${deviceNum}] ${ip} | ❓ 获取详细信息超时\n`)
        }
      })
    )
  }

  sender.send('lan-scan-data', `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
  sender.send('lan-scan-data', '[Summary] 扫描完成！\n')
  sender.send('lan-scan-data', `  - 网卡: ${selectedTarget.name}\n`)
  sender.send('lan-scan-data', `  - 扫描网段: ${selectedTarget.cidr}\n`)
  sender.send('lan-scan-data', `  - 扫描地址: ${scanHosts.length} 个\n`)
  sender.send('lan-scan-data', `  - 在线设备: ${aliveIPs.length} 个\n`)
  sender.send('lan-scan-data', `  - 详细信息: ${devices.length} 个\n`)
  sender.send('lan-scan-data', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  return devices
}

function buildNetworkTargets() {
  const networkInterfaces = os.networkInterfaces()
  const targets = []

  for (const [name, interfaces] of Object.entries(networkInterfaces)) {
    if (!interfaces) continue

    interfaces.forEach((iface, index) => {
      if (iface.family !== 'IPv4' || iface.internal || !isIpv4(iface.address)) return
      if (!iface.netmask || !isIpv4(iface.netmask)) return

      const prefixLength = getPrefixLength(iface.netmask)
      if (prefixLength === null) return

      const range = getNetworkRange(iface.address, prefixLength)
      const isVirtual = isVirtualInterface(name)
      const isPhysical = isPhysicalInterface(name)
      const isPrivate = isPrivateIpv4(iface.address)
      const isLinkLocal = iface.address.startsWith('169.254.')
      const score =
        (isPhysical ? 40 : 0) +
        (!isVirtual ? 30 : 0) +
        (isPrivate ? 20 : 0) +
        (!isLinkLocal ? 10 : 0) -
        (prefixLength < 20 ? 20 : 0)

      targets.push({
        id: `${name}::${iface.address}::${index}`,
        name,
        address: iface.address,
        netmask: iface.netmask,
        mac: iface.mac,
        prefixLength,
        cidr: `${range.networkAddress}/${prefixLength}`,
        networkAddress: range.networkAddress,
        broadcastAddress: range.broadcastAddress,
        firstHost: range.firstHost,
        lastHost: range.lastHost,
        hostCount: range.hostCount,
        isVirtual,
        isPhysical,
        isPrivate,
        isLinkLocal,
        score
      })
    })
  }

  targets.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  targets.forEach((target, index) => {
    target.isPreferred = index === 0
  })

  return targets
}

function selectNetworkTarget(targets, interfaceId) {
  if (interfaceId) {
    const selected = targets.find((target) => target.id === interfaceId)
    if (selected) return selected
  }

  return targets[0] || null
}

function getNetworkRange(address, prefixLength) {
  const addressInt = ipToInt(address)
  const maskInt = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0
  const networkInt = (addressInt & maskInt) >>> 0
  const broadcastInt = (networkInt | ~maskInt) >>> 0

  let firstHostInt = networkInt
  let lastHostInt = broadcastInt
  if (prefixLength < 31) {
    firstHostInt = (networkInt + 1) >>> 0
    lastHostInt = (broadcastInt - 1) >>> 0
  }

  const hostCount = lastHostInt >= firstHostInt ? lastHostInt - firstHostInt + 1 : 0

  return {
    networkAddress: intToIp(networkInt),
    broadcastAddress: intToIp(broadcastInt),
    firstHost: intToIp(firstHostInt),
    lastHost: intToIp(lastHostInt),
    firstHostInt,
    lastHostInt,
    hostCount
  }
}

function getScanHosts(target) {
  const range = getNetworkRange(target.address, target.prefixLength)
  const hosts = []

  for (let current = range.firstHostInt; current <= range.lastHostInt; current++) {
    hosts.push(intToIp(current >>> 0))
  }

  return hosts
}

function getPrefixLength(netmask) {
  const maskInt = ipToInt(netmask)
  const binary = maskInt.toString(2).padStart(32, '0')

  if (!/^1*0*$/.test(binary)) return null
  return binary.indexOf('0') === -1 ? 32 : binary.indexOf('0')
}

function ipToInt(ip) {
  const parts = ip.split('.').map(Number)
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

function intToIp(value) {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff].join(
    '.'
  )
}

function isIpv4(value) {
  return net.isIP(value) === 4
}

function isPrivateIpv4(address) {
  const [first, second] = address.split('.').map(Number)
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
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
    const timeout = 2000

    const macPromise = new Promise((resolve) => {
      runCommand('arp', ['-a', host], 800)
        .then((stdout) => {
          const macMatch = stdout.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/)
          if (macMatch) {
            const mac = macMatch[0].toUpperCase().replace(/-/g, ':')
            resolve({ mac, vendor: getVendorByMac(mac) })
            return
          }
          resolve({ mac: null, vendor: null })
        })
        .catch(() => {
          resolve({ mac: null, vendor: null })
        })
    })

    const hostnamePromise =
      process.platform === 'win32'
        ? new Promise((resolve) => {
            runCommand('nbtstat', ['-A', host], 800)
              .then((stdout) => {
                const lines = stdout.split('\n')
                for (const line of lines) {
                  const match = line.match(/^\s*([A-Z0-9\-_]+)\s+<00>\s+UNIQUE/i)
                  if (match) {
                    resolve(match[1].trim())
                    return
                  }
                }
                resolve(null)
              })
              .catch(() => {
                resolve(null)
              })
          })
        : Promise.resolve(null)

    const portsToScan = [22, 80, 139, 443, 445, 3306, 3389, 5432, 8080, 9100]
    const portPromise = Promise.all(
      portsToScan.map((port) => checkPort(host, port, 220).then((isOpen) => ({ port, isOpen })))
    )

    const [macResult, hostname, portResults] = await Promise.race([
      Promise.all([macPromise, hostnamePromise, portPromise]),
      new Promise((resolve) =>
        setTimeout(() => resolve([{ mac: null, vendor: null }, null, []]), timeout)
      )
    ])

    info.mac = macResult.mac
    info.vendor = macResult.vendor
    info.hostname = hostname
    info.openPorts = portResults.filter((result) => result.isOpen).map((result) => result.port)
    info.deviceType = guessDeviceType(info.openPorts, info.hostname, host)
  } catch (error) {
    console.error(`[LAN Scan] Error getting info for ${host}:`, error)
  }

  return info
}

async function checkHost(host, timeout = 2000) {
  try {
    const pingOutput = await runCommand(
      'ping',
      process.platform === 'win32'
        ? ['-n', '1', '-w', String(timeout), host]
        : ['-c', '1', '-W', String(Math.max(1, Math.floor(timeout / 1000))), host],
      timeout + 500
    )
    if (pingOutput.toLowerCase().includes('ttl=')) return true
  } catch {
    // ping 失败，继续尝试常见端口检测。
  }

  const commonPorts = [445, 80, 443, 22, 3389, 139, 8080]
  for (const port of commonPorts) {
    const isOpen = await checkPort(host, port, 800)
    if (isOpen) return true
  }

  return false
}

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
    '00:03:FF': 'Microsoft'
  }

  return vendors[prefix] || null
}

function guessDeviceType(openPorts, hostname, ip) {
  const portSet = new Set(openPorts)

  if (ip.endsWith('.1') && (portSet.has(80) || portSet.has(443))) return '🌐 路由器/网关'
  if (portSet.has(445) || portSet.has(3389)) return '💻 Windows 电脑'
  if (portSet.has(22) && !portSet.has(445)) return '🖥️ Linux 服务器'
  if ((portSet.has(80) || portSet.has(443) || portSet.has(8080)) && !portSet.has(445)) {
    return '🌍 Web 服务器'
  }
  if (portSet.has(3306) || portSet.has(5432)) return '🗄️ 数据库服务器'
  if (portSet.has(9100) || (hostname && hostname.toLowerCase().includes('printer')))
    return '🖨️ 打印机'
  if (openPorts.length <= 2) return '📱 移动设备'

  return '❓ 未知设备'
}

function isVirtualInterface(name) {
  const virtualPatterns = [
    'vEthernet',
    'VMware',
    'VirtualBox',
    'Hyper-V',
    'WSL',
    'Docker',
    'vboxnet',
    'vmnet',
    'Loopback',
    'Tailscale',
    'ZeroTier'
  ]

  return virtualPatterns.some((pattern) => name.toLowerCase().includes(pattern.toLowerCase()))
}

function isPhysicalInterface(name) {
  const physicalPatterns = ['WLAN', 'Wi-Fi', 'Wireless', '以太网', 'Ethernet', 'en', 'eth']
  return physicalPatterns.some((pattern) => name.toLowerCase().includes(pattern.toLowerCase()))
}
