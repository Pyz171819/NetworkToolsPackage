<template>
  <div class="panel tcp-panel">
    <div class="input-group">
      <span class="prefix">HOST &gt;</span>
      <input v-model="host" type="text" placeholder="输入主机或 IP 地址" @keyup.enter="connect" />
      <span class="prefix">PORT &gt;</span>
      <input
        v-model="port"
        type="text"
        inputmode="numeric"
        class="port-input"
        placeholder="23"
        @keyup.enter="connect"
      />
      <button v-if="connected || connecting" class="stop-btn" @click="disconnect">
        {{ connecting ? '取消' : '断开' }}
      </button>
      <button v-else :disabled="!host || !port" @click="connect">建立连接</button>
    </div>

    <div class="toolbar">
      <div class="status-group">
        <span class="status-dot" :class="statusClass"></span>
        <span class="status-text">{{ statusText }}</span>
      </div>
      <div class="mode-group">
        <button
          v-for="mode in newlineModes"
          :key="mode.value"
          :class="['mode-btn', { active: newlineMode === mode.value }]"
          @click="newlineMode = mode.value"
        >
          {{ mode.label }}
        </button>
      </div>
    </div>

    <TerminalView
      title="Terminal - TCP 终端"
      :output="output"
      placeholder="等待建立 TCP 连接...\n连接成功后即可向远端服务发送文本并查看返回。"
      @clear="output = ''"
    />

    <div class="send-bar">
      <span class="input-prefix">send &gt;</span>
      <input
        v-model="inputText"
        type="text"
        placeholder="输入要发送的内容，回车发送"
        :disabled="!connected"
        @keyup.enter="send"
      />
      <button :disabled="!connected || !inputText" @click="send">发送</button>
    </div>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref } from 'vue'
import TerminalView from './TerminalView.vue'

const host = ref('www.baidu.com')
const port = ref('80')
const inputText = ref('')
const output = ref('')
const connected = ref(false)
const connecting = ref(false)
const newlineMode = ref('crlf')
const lastEndpoint = ref('')
let offTcpData = null
let offTcpStatus = null

const newlineModes = [
  { value: 'none', label: 'RAW' },
  { value: 'lf', label: 'LF' },
  { value: 'crlf', label: 'CRLF' }
]

const statusText = computed(() => {
  if (connecting.value) return '连接中...'
  if (connected.value) return `已连接 ${lastEndpoint.value}`
  return '未连接'
})

const statusClass = computed(() => {
  if (connecting.value) return 'status-pending'
  if (connected.value) return 'status-online'
  return 'status-offline'
})

const appendOutput = (text) => {
  output.value += text
}

const bindSocketEvents = () => {
  offTcpData?.()
  offTcpStatus?.()

  offTcpData = window.api.onTcpTerminalData((data) => {
    appendOutput(data)
  })

  offTcpStatus = window.api.onTcpTerminalStatus((status) => {
    if (status.state === 'connected') {
      connected.value = true
      connecting.value = false
      lastEndpoint.value = `${status.host}:${status.port}`
      appendOutput(`\n[System] 已连接到 ${status.host}:${status.port} (${status.durationMs}ms)\n`)
      return
    }

    if (status.state === 'error') {
      connected.value = false
      connecting.value = false
      appendOutput(`\n[Error] ${status.message}\n`)
      return
    }

    if (status.state === 'disconnected') {
      const wasActive = connected.value || connecting.value
      connected.value = false
      connecting.value = false
      if (wasActive) {
        appendOutput(`\n[System] ${status.message}\n`)
      }
    }
  })
}

const resetSocketEvents = () => {
  offTcpData?.()
  offTcpStatus?.()
  offTcpData = null
  offTcpStatus = null
}

const connect = async () => {
  if (connected.value || connecting.value) return

  connecting.value = true
  appendOutput(`\n━━━ [${new Date().toLocaleTimeString()}] 连接 ${host.value}:${port.value} ━━━\n`)
  bindSocketEvents()

  try {
    await window.api.connectTcpTerminal(host.value, port.value)
  } catch (error) {
    connecting.value = false
    connected.value = false
    appendOutput(`\n[Error] ${error.message || error}\n`)
    resetSocketEvents()
  }
}

const disconnect = async () => {
  if (!connected.value && !connecting.value) return

  try {
    await window.api.disconnectTcpTerminal()
  } finally {
    connected.value = false
    connecting.value = false
    resetSocketEvents()
  }
}

const send = async () => {
  if (!connected.value || !inputText.value) return

  const message = inputText.value
  try {
    await window.api.sendTcpTerminal(message, newlineMode.value)
    appendOutput(`\n>>> ${message}\n`)
    inputText.value = ''
  } catch (error) {
    appendOutput(`\n[Error] ${error.message || error}\n`)
  }
}

onUnmounted(() => {
  resetSocketEvents()
})
</script>

<style scoped>
@import '../assets/input-group.css';

.tcp-panel {
  min-width: 0;
}

.port-input {
  width: 90px;
  flex: none;
  border-left: 1px solid #243240;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: rgba(16, 22, 30, 0.86);
  border: 1px solid #243240;
  border-radius: 10px;
}

.status-group {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  flex-shrink: 0;
}

.status-dot.status-offline {
  background: #e76161;
}

.status-dot.status-pending {
  background: #ffbd2e;
}

.status-dot.status-online {
  background: #27c93f;
}

.status-text {
  color: #dce6f1;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mode-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mode-btn {
  min-width: 58px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid #2d4053;
  border-radius: 8px;
  background: rgba(23, 31, 41, 0.9);
  color: #8ea0b3;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  transition: all 0.2s ease;
}

.mode-btn:hover {
  color: #dce6f1;
  border-color: #3f5970;
}

.mode-btn.active {
  background: linear-gradient(180deg, #0f7fd7 0%, #0b68bb 100%);
  border-color: #2da0ff;
  color: #fff;
}

.send-bar {
  display: flex;
  align-items: center;
  background: rgba(16, 22, 30, 0.98);
  border: 1px solid #243240;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
}

.input-prefix {
  padding: 10px 12px;
  background: rgba(24, 32, 42, 0.95);
  color: #f2c56d;
  font-weight: bold;
  font-size: 12px;
  white-space: nowrap;
  font-family: 'Consolas', 'Courier New', monospace;
  border-right: 1px solid #243240;
}

.send-bar input {
  flex: 1;
  height: 42px;
  padding: 0 12px;
  background: transparent;
  color: #eef4fb;
  border: none;
  outline: none;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 14px;
}

.send-bar input::placeholder {
  color: #667588;
}

.send-bar button {
  height: 42px;
  padding: 0 18px;
  border: none;
  background: linear-gradient(180deg, #1382d4 0%, #0c67b6 100%);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.send-bar button:hover:not(:disabled) {
  filter: brightness(1.08);
}

.send-bar button:disabled {
  background: #2a3542;
  color: #738296;
  cursor: not-allowed;
}
</style>
