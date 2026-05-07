<template>
  <div class="panel">
    <div class="input-group">
      <span class="prefix">TARGET &gt;</span>
      <input v-model="target" type="text" placeholder="输入 IP 地址或域名" @keyup.enter="run" />
      <button v-if="running" class="stop-btn" @click="abort">停止</button>
      <button v-else :disabled="!target" @click="run">开始 Ping</button>
    </div>
    <TerminalView title="Terminal - Ping 探测" :output="output" @clear="output = ''" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import TerminalView from './TerminalView.vue'

const target = ref('www.baidu.com')
const output = ref('')
const running = ref(false)

const run = async () => {
  if (!target.value || running.value) return

  running.value = true
  output.value += `\n━━━ [${new Date().toLocaleTimeString()}] Ping ${target.value} ━━━\n`

  window.api.onPingData((data) => {
    output.value += data
  })

  try {
    await window.api.pingTest(target.value)
  } catch (error) {
    output.value += `\n[Error] 执行出错: ${error}`
  } finally {
    running.value = false
    window.api?.offPingData()
  }
}

const abort = () => {
  window.api?.abortPing()
}
</script>

<style scoped>
@import '../assets/input-group.css';
</style>
