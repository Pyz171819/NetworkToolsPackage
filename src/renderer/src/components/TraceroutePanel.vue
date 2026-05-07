<template>
  <div class="panel">
    <div class="input-group">
      <span class="prefix">TARGET &gt;</span>
      <input v-model="target" type="text" placeholder="输入 IP 地址或域名" @keyup.enter="run" />
      <button v-if="running" class="stop-btn" @click="abort">停止</button>
      <button v-else :disabled="!target" @click="run">开始追踪</button>
    </div>
    <TerminalView title="Terminal - 路由追踪" :output="output" @clear="output = ''" />
  </div>
</template>

<script setup>
import { ref, onActivated } from 'vue'
import TerminalView from './TerminalView.vue'

const target = ref('www.baidu.com')
const output = ref('')
const running = ref(false)

onActivated(() => {
  output.value = ''
})

const run = async () => {
  if (!target.value || running.value) return

  if (!window.api?.traceroute) {
    output.value = '[Error] 路由追踪API未加载，请重启应用\n'
    return
  }

  running.value = true
  output.value = `[System] 正在追踪到 ${target.value} 的路由...\n\n`

  window.api.onTracerouteData((data) => {
    output.value += data
  })

  try {
    await window.api.traceroute(target.value)
  } catch (error) {
    output.value += `\n[Error] 执行出错: ${error}`
  } finally {
    running.value = false
    window.api?.offTracerouteData()
  }
}

const abort = () => {
  window.api?.abortTraceroute()
}
</script>

<style scoped>
@import '../assets/input-group.css';
</style>
