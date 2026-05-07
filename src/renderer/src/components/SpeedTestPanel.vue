<template>
  <div class="panel">
    <div class="input-group">
      <span class="prefix">SPEEDTEST ></span>
      <button @click="runTest" :disabled="running">
        {{ running ? '测速中...' : '开始测速' }}
      </button>
    </div>

    <div class="speed-results" v-if="result">
      <div class="speed-card">
        <div class="speed-label">下载</div>
        <div class="speed-value" :class="speedClass(result.download)">
          {{ formatSpeed(result.download) }}
        </div>
        <div class="speed-unit">Mbps</div>
      </div>
      <div class="speed-card">
        <div class="speed-label">上传</div>
        <div class="speed-value" :class="speedClass(result.upload)">
          {{ formatSpeed(result.upload) }}
        </div>
        <div class="speed-unit">Mbps</div>
      </div>
      <div class="speed-card">
        <div class="speed-label">延迟</div>
        <div class="speed-value" :class="pingClass(result.ping)">
          {{ result.ping }}
        </div>
        <div class="speed-unit">ms</div>
      </div>
      <div class="speed-card server-info">
        <div class="speed-label">服务器</div>
        <div class="server-name">{{ result.server.sponsor }}</div>
        <div class="server-location">{{ result.server.country }}</div>
      </div>
    </div>

    <div class="progress-section" v-if="running">
      <div class="progress-item">
        <div class="progress-label">
          <span>下载测速</span>
          <span class="progress-value" v-if="currentDownload">{{ currentDownload.toFixed(1) }} Mbps</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill download-fill" :style="{ width: downloadProgress + '%' }"></div>
        </div>
      </div>
      <div class="progress-item">
        <div class="progress-label">
          <span>上传测速</span>
          <span class="progress-value" v-if="currentUpload">{{ currentUpload.toFixed(1) }} Mbps</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill upload-fill" :style="{ width: uploadProgress + '%' }"></div>
        </div>
      </div>
    </div>

    <TerminalView title="Speed Test Log" :output="output" placeholder='点击"开始测速"启动网络速度测试...' />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import TerminalView from './TerminalView.vue'

const output = ref('')
const running = ref(false)
const result = ref(null)
const currentDownload = ref(0)
const currentUpload = ref(0)
const downloadProgress = ref(0)
const uploadProgress = ref(0)

function formatSpeed(mbps) {
  if (!mbps || mbps <= 0) return '0.00'
  return mbps.toFixed(2)
}

function speedClass(mbps) {
  if (mbps >= 100) return 'speed-fast'
  if (mbps >= 30) return 'speed-good'
  if (mbps >= 10) return 'speed-mid'
  return 'speed-slow'
}

function pingClass(ping) {
  if (ping <= 20) return 'speed-fast'
  if (ping <= 50) return 'speed-good'
  if (ping <= 100) return 'speed-mid'
  return 'speed-slow'
}

function extractSpeed(line) {
  const match = line.match(/当前速度:\s*([\d.]+)\s*Mbps/)
  if (match) return parseFloat(match[1])
  const completeMatch = line.match(/完成:\s*([\d.]+)\s*Mbps/)
  if (completeMatch) return parseFloat(completeMatch[1])
  return null
}

async function runTest() {
  if (!window.api?.speedTest) return

  running.value = true
  output.value = ''
  result.value = null
  currentDownload.value = 0
  currentUpload.value = 0
  downloadProgress.value = 0
  uploadProgress.value = 0

  let phase = 'init'

  window.api.onSpeedTestData((data) => {
    output.value += data

    if (data.includes('[Download] 开始')) phase = 'download'
    if (data.includes('[Upload] 开始')) phase = 'upload'

    const speed = extractSpeed(data)
    if (speed !== null) {
      if (phase === 'download') {
        currentDownload.value = speed
        downloadProgress.value = Math.min(95, downloadProgress.value + 8)
      } else if (phase === 'upload') {
        currentUpload.value = speed
        uploadProgress.value = Math.min(95, uploadProgress.value + 12)
      }
    }

    if (data.includes('[Download] 完成')) downloadProgress.value = 100
    if (data.includes('[Upload] 完成')) uploadProgress.value = 100
  })

  window.api.onSpeedTestResult((res) => {
    if (res) result.value = res
  })

  try {
    await window.api.speedTest()
  } finally {
    window.api?.offSpeedTestData()
    window.api?.offSpeedTestResult()
    running.value = false
  }
}
</script>

<style scoped>
.panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 12px;
}

.input-group {
  display: flex;
  align-items: center;
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.prefix {
  padding: 10px 15px;
  color: #00ffcc;
  font-weight: bold;
  font-family: 'Consolas', 'Courier New', monospace;
  background: #252525;
  border-right: 1px solid #333;
  white-space: nowrap;
}

button {
  flex: 1;
  padding: 10px 20px;
  background: #007acc;
  border: none;
  color: #fff;
  cursor: pointer;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 13px;
  transition: all 0.3s;
}

button:hover:not(:disabled) {
  background: #0098ff;
}

button:disabled {
  background: #444;
  color: #888;
  cursor: not-allowed;
}

.speed-results {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.speed-card {
  flex: 1;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 12px;
  text-align: center;
}

.speed-label {
  color: #888;
  font-size: 11px;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.speed-value {
  font-size: 28px;
  font-weight: bold;
  font-family: 'Consolas', 'Courier New', monospace;
}

.speed-unit {
  color: #666;
  font-size: 12px;
  margin-top: 2px;
}

.speed-fast {
  color: #27c93f;
}

.speed-good {
  color: #00ffcc;
}

.speed-mid {
  color: #ffbd2e;
}

.speed-slow {
  color: #ff5f56;
}

.server-info .speed-value {
  font-size: 16px;
}

.server-name {
  color: #e0e0e0;
  font-size: 14px;
  font-weight: bold;
  font-family: 'Consolas', 'Courier New', monospace;
}

.server-location {
  color: #666;
  font-size: 12px;
  margin-top: 2px;
}

.progress-section {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.progress-item {
  flex: 1;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 10px;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #888;
  margin-bottom: 6px;
}

.progress-value {
  color: #00ffcc;
  font-weight: bold;
  font-family: 'Consolas', 'Courier New', monospace;
}

.progress-bar {
  height: 6px;
  background: #0d0d0d;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.download-fill {
  background: #00ffcc;
}

.upload-fill {
  background: #007acc;
}
</style>
