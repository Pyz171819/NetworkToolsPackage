<template>
  <div class="terminal-wrapper">
    <div class="terminal-header">
      <span class="dot red"></span>
      <span class="dot yellow"></span>
      <span class="dot green"></span>
      <span class="terminal-title">{{ title }}</span>
      <button v-if="output" class="clear-btn" @click="$emit('clear')" title="清空输出">清除</button>
    </div>
    <div ref="terminalRef" class="terminal">
      <pre>{{ output || placeholder }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  title: { type: String, default: 'Terminal' },
  output: { type: String, default: '' },
  placeholder: { type: String, default: '等待执行任务...\n请输入目标并点击扫描。' }
})

defineEmits(['clear'])

const terminalRef = ref(null)

watch(
  () => props.output,
  () => {
    nextTick(() => {
      if (terminalRef.value) {
        terminalRef.value.scrollTop = terminalRef.value.scrollHeight
      }
    })
  }
)
</script>

<style scoped>
.terminal-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #000;
  border-radius: 6px;
  border: 1px solid #333;
  overflow: hidden;
  min-height: 0;
}

.terminal-header {
  background: #1a1a1a;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 6px;
}

.red {
  background: #ff5f56;
}

.yellow {
  background: #ffbd2e;
}

.green {
  background: #27c93f;
}

.terminal-title {
  color: #888;
  font-size: 11px;
  margin-left: 8px;
}

.clear-btn {
  margin-left: auto;
  background: transparent;
  border: 1px solid #555;
  color: #888;
  padding: 2px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s;
}

.clear-btn:hover {
  border-color: #ff5f56;
  color: #ff5f56;
}

.terminal {
  padding: 12px;
  overflow-y: auto;
  flex: 1;
}

pre {
  white-space: pre-wrap;
  color: #00ff00;
  line-height: 1.4;
  font-size: 12px;
  font-family: 'Consolas', 'Courier New', monospace;
}
</style>
