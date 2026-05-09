import { existsSync, statSync } from 'fs'
import net from 'net'

const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)(localhost|(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)$/

const SAFE_HOST_PATTERN = /^[a-zA-Z0-9._:-]+$/
const SAFE_PORT_INPUT_PATTERN = /^[\d,\-\s]+$/
const ALLOWED_SCRIPT_EXTENSIONS = new Set(['bat', 'py', 'sh'])
const TCP_NEWLINE_MODES = new Set(['none', 'lf', 'crlf'])

export function validateHostInput(value, label = '目标') {
  if (typeof value !== 'string') {
    throw new Error(`${label}必须是字符串`)
  }

  const host = value.trim()
  if (!host) {
    throw new Error(`${label}不能为空`)
  }

  if (host.length > 253) {
    throw new Error(`${label}长度不能超过 253 个字符`)
  }

  if (!SAFE_HOST_PATTERN.test(host)) {
    throw new Error(`${label}包含非法字符`)
  }

  if (net.isIP(host) === 4 || host === 'localhost' || HOSTNAME_PATTERN.test(host)) {
    return host
  }

  throw new Error(`${label}格式无效，请输入 IPv4、域名或 localhost`)
}

export function validatePortScanPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('端口扫描参数无效')
  }

  const host = validateHostInput(payload.host, '扫描目标')
  const portsText = validatePortsInput(payload.ports)

  return { host, portsText }
}

export function validatePortsInput(value) {
  if (typeof value !== 'string') {
    throw new Error('端口范围必须是字符串')
  }

  const portsText = value.trim()
  if (!portsText) {
    throw new Error('端口范围不能为空')
  }

  if (portsText.length > 2000) {
    throw new Error('端口范围输入过长')
  }

  if (!SAFE_PORT_INPUT_PATTERN.test(portsText)) {
    throw new Error('端口范围只能包含数字、逗号、短横线和空格')
  }

  return portsText
}

export function assertValidPortNumber(port, label = '端口') {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${label}必须在 1 到 65535 之间`)
  }
}

export function validatePortValue(value, label = '端口') {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? parseInt(value.trim(), 10)
        : Number.NaN

  assertValidPortNumber(parsed, label)
  return parsed
}

export function validatePortListSize(portList, maxPorts = 2048) {
  if (portList.length === 0) {
    throw new Error('没有可扫描的有效端口')
  }

  if (portList.length > maxPorts) {
    throw new Error(`单次最多扫描 ${maxPorts} 个端口，请缩小范围`)
  }
}

export function validateScriptPath(scriptPath) {
  if (typeof scriptPath !== 'string') {
    throw new Error('脚本路径必须是字符串')
  }

  const normalizedPath = scriptPath.trim()
  if (!normalizedPath) {
    throw new Error('脚本路径不能为空')
  }

  if (!existsSync(normalizedPath)) {
    throw new Error('脚本文件不存在')
  }

  const stats = statSync(normalizedPath)
  if (!stats.isFile()) {
    throw new Error('脚本路径必须指向文件')
  }

  const ext = normalizedPath.split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_SCRIPT_EXTENSIONS.has(ext)) {
    throw new Error(`不支持的脚本类型: .${ext || 'unknown'}`)
  }

  return { scriptPath: normalizedPath, ext }
}

export function validateScriptInputText(value) {
  if (typeof value !== 'string') {
    throw new Error('脚本输入必须是字符串')
  }

  if (!value.trim()) {
    throw new Error('脚本输入不能为空')
  }

  if (value.length > 5000) {
    throw new Error('脚本输入过长，请控制在 5000 个字符以内')
  }

  return value
}

export function validateTcpConnectPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('TCP 连接参数无效')
  }

  const host = validateHostInput(payload.host, 'TCP 主机')
  const port = validatePortValue(payload.port, 'TCP 端口')
  return { host, port }
}

export function validateTcpSendPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('TCP 发送参数无效')
  }

  const text = typeof payload.text === 'string' ? payload.text : ''
  if (!text) {
    throw new Error('发送内容不能为空')
  }

  if (text.length > 20000) {
    throw new Error('发送内容过长，请控制在 20000 个字符以内')
  }

  const newlineMode = typeof payload.newlineMode === 'string' ? payload.newlineMode : 'none'
  if (!TCP_NEWLINE_MODES.has(newlineMode)) {
    throw new Error('换行模式无效')
  }

  return { text, newlineMode }
}
