<template>
  <div class="panel">
    <div class="input-group">
      <span class="prefix">TARGET &gt;</span>
      <input v-model="host" type="text" placeholder="输入 IP 地址或域名" />
      <span class="prefix">PORTS &gt;</span>
      <input v-model="ports" type="text" placeholder="80,443,3306 或 1-1000" class="port-input" />
      <button :disabled="running" @click="run">
        {{ running ? `扫描中 ${progress}%` : '开始扫描' }}
      </button>
    </div>
    <TerminalView title="Terminal - 端口扫描" :output="output" @clear="output = ''" />
  </div>
</template>

<script setup>
import { ref, onActivated } from 'vue'
import TerminalView from './TerminalView.vue'

const host = ref('www.baidu.com')
const ports = ref('80,443,3306,8080')
const output = ref('')
const running = ref(false)
const progress = ref(0)

onActivated(() => {
  output.value = ''
})

const run = async () => {
  if (!host.value || !ports.value || running.value) return

  running.value = true
  progress.value = 0
  output.value = `[System] 准备扫描 ${host.value}...\n`

  if (window.api) {
    window.api.onScanData((data) => {
      output.value += data
    })

    window.api.onScanProgress((data) => {
      progress.value = data.progress
    })
  }

  try {
    await window.api.portScan(host.value, ports.value)
  } catch (error) {
    output.value += `\n[Error] 执行出错: ${error}`
  } finally {
    running.value = false
    progress.value = 0
    window.api?.offScanData()
  }
}
</script>

<style scoped>
@import '../assets/input-group.css';

.port-input {
  width: 180px;
  flex: none;
  border-left: 1px solid #333;
}
</style>
