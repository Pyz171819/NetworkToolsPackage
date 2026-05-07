<template>
  <div class="panel">
    <div class="input-group">
      <span class="prefix">LAN SCAN &gt;</span>
      <span class="scan-info">自动检测当前网段并扫描在线设备</span>
      <button :disabled="running" @click="run">
        {{ running ? `扫描中 ${progress}%` : '开始扫描' }}
      </button>
    </div>
    <TerminalView title="Terminal - 局域网扫描" :output="output" @clear="output = ''" />
  </div>
</template>

<script setup>
import { ref, onActivated } from 'vue'
import TerminalView from './TerminalView.vue'

const output = ref('')
const running = ref(false)
const progress = ref(0)

onActivated(() => {
  output.value = ''
})

const run = async () => {
  if (running.value) return

  if (!window.api?.lanScan) {
    output.value = '[Error] 局域网扫描API未加载，请重启应用\n'
    return
  }

  running.value = true
  progress.value = 0
  output.value = `[System] 正在扫描局域网...\n\n`

  window.api.onLanScanData((data) => {
    output.value += data
  })

  window.api.onLanScanProgress((data) => {
    progress.value = data.progress
  })

  try {
    await window.api.lanScan()
  } catch (error) {
    output.value += `\n[Error] 执行出错: ${error}`
  } finally {
    running.value = false
    progress.value = 0
    window.api?.offLanScanData()
  }
}
</script>

<style scoped>
@import '../assets/input-group.css';

.scan-info {
  flex: 1;
  padding: 10px 15px;
  color: #888;
  font-size: 13px;
}
</style>
