<template>
  <div class="terminal-wrapper">
    <div class="terminal-header">
      <span class="dot red"></span>
      <span class="dot yellow"></span>
      <span class="dot green"></span>
      <span class="terminal-title">{{ title }}</span>
      <button v-if="output" class="clear-btn" title="清空输出" @click="$emit('clear')">清除</button>
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
  background: linear-gradient(180deg, rgba(11, 16, 21, 0.98) 0%, rgba(8, 12, 17, 0.98) 100%);
  border-radius: 14px;
  border: 1px solid rgba(67, 88, 110, 0.42);
  overflow: hidden;
  min-height: 0;
  box-shadow:
    0 18px 34px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.02);
}

.terminal-header {
  background: linear-gradient(180deg, rgba(17, 24, 32, 0.99) 0%, rgba(14, 20, 28, 0.99) 100%);
  padding: 11px 13px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid rgba(67, 88, 110, 0.36);
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
  color: #9bacc0;
  font-size: 11px;
  margin-left: 8px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.clear-btn {
  margin-left: auto;
  background: transparent;
  border: 1px solid #324355;
  color: #8b9aab;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s ease;
}

.clear-btn:hover {
  border-color: #df6a6a;
  color: #f3d2d2;
  background: rgba(223, 106, 106, 0.08);
}

.terminal {
  padding: 15px;
  overflow-y: auto;
  flex: 1;
  background-image: linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px);
  background-size: 100% 24px;
}

pre {
  white-space: pre-wrap;
  color: #8cf2bc;
  line-height: 1.55;
  font-size: 12px;
  font-family: 'Consolas', 'Courier New', monospace;
  text-shadow: 0 0 12px rgba(140, 242, 188, 0.05);
}
</style>
