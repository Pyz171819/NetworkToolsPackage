<template>
  <div class="panel">
    <div class="input-group">
      <span class="prefix">SUBNET &gt;</span>
      <input
        v-model="input"
        type="text"
        placeholder="输入 IP/CIDR，如 192.168.1.0/24"
        @input="calculate"
      />
      <button @click="fillExample">示例</button>
    </div>

    <div v-if="result" class="result-grid">
      <div class="result-section">
        <div class="section-title">基本信息</div>
        <div class="result-rows">
          <div class="result-row">
            <span class="label">IP 地址</span>
            <span class="value">{{ result.ip }}</span>
          </div>
          <div class="result-row">
            <span class="label">子网掩码</span>
            <span class="value">{{ result.mask }}</span>
          </div>
          <div class="result-row">
            <span class="label">通配符掩码</span>
            <span class="value">{{ result.wildcard }}</span>
          </div>
          <div class="result-row">
            <span class="label">CIDR 前缀</span>
            <span class="value">/{{ result.cidr }}</span>
          </div>
          <div class="result-row">
            <span class="label">IP 类别</span>
            <span class="value">{{ result.ipClass }}</span>
          </div>
          <div class="result-row">
            <span class="label">地址类型</span>
            <span class="value">{{ result.addressType }}</span>
          </div>
        </div>
      </div>

      <div class="result-section">
        <div class="section-title">网络范围</div>
        <div class="result-rows">
          <div class="result-row">
            <span class="label">网络地址</span>
            <span class="value highlight">{{ result.network }}</span>
          </div>
          <div class="result-row">
            <span class="label">广播地址</span>
            <span class="value highlight">{{ result.broadcast }}</span>
          </div>
          <div class="result-row">
            <span class="label">首个可用主机</span>
            <span class="value">{{ result.firstHost }}</span>
          </div>
          <div class="result-row">
            <span class="label">末个可用主机</span>
            <span class="value">{{ result.lastHost }}</span>
          </div>
          <div class="result-row">
            <span class="label">可用主机数</span>
            <span class="value">{{ result.usableHosts.toLocaleString() }}</span>
          </div>
          <div class="result-row">
            <span class="label">总主机数</span>
            <span class="value">{{ result.totalHosts.toLocaleString() }}</span>
          </div>
        </div>
      </div>

      <div class="result-section full-width">
        <div class="section-title">二进制表示</div>
        <div class="binary-row">
          <span class="label">IP 地址</span>
          <span class="binary-value">{{ result.binaryIp }}</span>
        </div>
        <div class="binary-row">
          <span class="label">子网掩码</span>
          <span class="binary-value">{{ result.binaryMask }}</span>
        </div>
        <div class="binary-row">
          <span class="label">网络地址</span>
          <span class="binary-value">{{ result.binaryNetwork }}</span>
        </div>
      </div>
    </div>

    <div v-else-if="input" class="error-msg">格式错误，请输入如 192.168.1.0/24 的格式</div>

    <div v-else class="placeholder">输入 IP 地址和 CIDR 前缀进行子网计算</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const input = ref('')
const result = ref(null)

const examples = [
  '192.168.1.0/24',
  '10.0.0.0/8',
  '172.16.0.0/16',
  '192.168.1.128/26',
  '10.10.10.0/30'
]
let exampleIndex = 0

function fillExample() {
  input.value = examples[exampleIndex % examples.length]
  exampleIndex++
  calculate()
}

function ipToInt(ip) {
  const parts = ip.split('.').map(Number)
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

function intToIp(int) {
  return [(int >>> 24) & 0xff, (int >>> 16) & 0xff, (int >>> 8) & 0xff, int & 0xff].join('.')
}

function intToBinary(int) {
  return (
    ((int >>> 24) & 0xff).toString(2).padStart(8, '0') +
    '.' +
    ((int >>> 16) & 0xff).toString(2).padStart(8, '0') +
    '.' +
    ((int >>> 8) & 0xff).toString(2).padStart(8, '0') +
    '.' +
    (int & 0xff).toString(2).padStart(8, '0')
  )
}

function getIpClass(ip) {
  const first = ip.split('.').map(Number)[0]
  if (first >= 240) return 'E 类 (保留)'
  if (first >= 224) return 'D 类 (组播)'
  if (first >= 192) return 'C 类'
  if (first >= 128) return 'B 类'
  if (first >= 1) return 'A 类'
  return '特殊地址'
}

function getAddressType(ip) {
  const int = ipToInt(ip)
  if (int === 0) return '全零地址'
  if (int === 0xffffffff) return '受限广播'
  const parts = ip.split('.').map(Number)
  if (parts[0] === 127) return '环回地址'
  if (parts[0] === 10) return '私有地址 (A 类)'
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return '私有地址 (B 类)'
  if (parts[0] === 192 && parts[1] === 168) return '私有地址 (C 类)'
  if (parts[0] === 169 && parts[1] === 254) return '链路本地地址'
  return '公网地址'
}

function calculate() {
  const str = input.value.trim()
  const match = str.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\s*\/\s*(\d{1,2})$/)
  if (!match) {
    result.value = null
    return
  }

  const parts = match.slice(1, 6).map(Number)
  if (parts.some((p, i) => i < 4 && p > 255) || parts[4] > 32) {
    result.value = null
    return
  }

  const ip = `${parts[0]}.${parts[1]}.${parts[2]}.${parts[3]}`
  const cidr = parts[4]
  const maskInt = cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0
  const ipInt = ipToInt(ip)
  const networkInt = (ipInt & maskInt) >>> 0
  const broadcastInt = (networkInt | ~maskInt) >>> 0
  const totalHosts = 2 ** (32 - cidr)
  const usableHosts = cidr >= 31 ? (cidr === 31 ? 2 : 1) : totalHosts - 2
  const firstHostInt = cidr >= 31 ? networkInt : (networkInt + 1) >>> 0
  const lastHostInt = cidr >= 31 ? broadcastInt : (broadcastInt - 1) >>> 0

  result.value = {
    ip,
    cidr,
    mask: intToIp(maskInt),
    wildcard: intToIp(~maskInt >>> 0),
    network: intToIp(networkInt),
    broadcast: intToIp(broadcastInt),
    firstHost: intToIp(firstHostInt),
    lastHost: intToIp(lastHostInt),
    totalHosts,
    usableHosts,
    ipClass: getIpClass(ip),
    addressType: getAddressType(ip),
    binaryIp: intToBinary(ipInt),
    binaryMask: intToBinary(maskInt),
    binaryNetwork: intToBinary(networkInt)
  }
}
</script>

<style scoped>
@import '../assets/input-group.css';

.result-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  overflow-y: auto;
  min-height: 0;
}

.result-section {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 12px;
}

.result-section.full-width {
  grid-column: 1 / -1;
}

.section-title {
  color: #00ffcc;
  font-weight: bold;
  font-size: 13px;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid #333;
}

.result-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.result-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background: #0d0d0d;
  border-radius: 3px;
}

.label {
  color: #888;
  font-size: 12px;
}

.value {
  color: #e0e0e0;
  font-size: 13px;
  font-family: 'Consolas', 'Courier New', monospace;
}

.value.highlight {
  color: #00ffcc;
  font-weight: bold;
}

.binary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background: #0d0d0d;
  border-radius: 3px;
  margin-bottom: 4px;
}

.binary-value {
  color: #ffbd2e;
  font-size: 13px;
  font-family: 'Consolas', 'Courier New', monospace;
  letter-spacing: 1px;
}

.error-msg {
  text-align: center;
  color: #ff5f56;
  padding: 30px;
  font-size: 13px;
}

.placeholder {
  text-align: center;
  color: #666;
  padding: 30px;
  font-size: 13px;
}
</style>
