<template>
  <div :class="['panel', { collapsed }]">
    <div class="panel-header" @dblclick="collapsed = !collapsed">
      <span class="icon">📡</span>
      <span>延时监控</span>
      <button class="collapse-btn" @click="collapsed = !collapsed" :title="collapsed ? '展开' : '收起'">
        {{ collapsed ? '◀' : '▶' }}
      </button>
      <button v-if="!collapsed" class="refresh-btn" :disabled="isPingingAll" @click.stop="pingAll">
        {{ isPingingAll ? '⟳' : '↻' }}
      </button>
    </div>
    <div v-if="!collapsed" class="ping-list">
      <div
        v-for="target in targets"
        :key="target.name"
        class="ping-item"
        :class="{
          pinging: target.isPinging,
          success: target.status === 'success',
          failed: target.status === 'failed'
        }"
      >
        <div class="ping-info">
          <div class="target-name-row">
            <img :src="target.icon" :alt="target.name" class="target-icon" />
            <span class="target-name">{{ target.name }}</span>
          </div>
          <span class="target-host">{{ target.host }}</span>
        </div>
        <div class="ping-latency">
          <span v-if="target.isPinging" class="status">...</span>
          <span
            v-else-if="target.latency !== null"
            class="latency-value"
            :class="latencyClass(target.latency)"
          >{{ target.latency }}ms</span>
          <span v-else class="status">-</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import baiduIcon from '../assets/icons/baidu.ico'
import bilibiliIcon from '../assets/icons/bilibili.ico'
import tencentIcon from '../assets/icons/tencent.ico'
import huaweiIcon from '../assets/icons/huawei.ico'
import douyinIcon from '../assets/icons/douyin.ico'
import iqiyiIcon from '../assets/icons/iqiyi.ico'

const targets = reactive([
  {
    name: '百度',
    host: 'www.baidu.com',
    icon: baiduIcon,
    latency: null,
    isPinging: false,
    status: null
  },
  {
    name: 'B站',
    host: 'www.bilibili.com',
    icon: bilibiliIcon,
    latency: null,
    isPinging: false,
    status: null
  },
  {
    name: '腾讯云',
    host: 'cloud.tencent.com',
    icon: tencentIcon,
    latency: null,
    isPinging: false,
    status: null
  },
  {
    name: '华为云',
    host: 'www.huaweicloud.com',
    icon: huaweiIcon,
    latency: null,
    isPinging: false,
    status: null
  },
  {
    name: '抖音',
    host: 'www.douyin.com',
    icon: douyinIcon,
    latency: null,
    isPinging: false,
    status: null
  },
  {
    name: '爱奇艺',
    host: 'www.iqiyi.com',
    icon: iqiyiIcon,
    latency: null,
    isPinging: false,
    status: null
  }
])

const isPingingAll = ref(false)
const collapsed = ref(false)

const latencyClass = (ms) => {
  if (ms < 50) return 'latency-good'
  if (ms < 100) return 'latency-ok'
  return 'latency-bad'
}

const extractLatency = (pingOutput) => {
  const patterns = [/平均\s*=\s*(\d+)ms/, /Average\s*=\s*(\d+)ms/, /time[=<](\d+\.?\d*)[\s]?ms/i]

  for (const pattern of patterns) {
    const match = pingOutput.match(pattern)
    if (match) {
      return Math.round(parseFloat(match[1]))
    }
  }
  return null
}

const pingTarget = async (target) => {
  if (!window.api?.quickPing) {
    target.status = 'failed'
    return
  }

  target.isPinging = true
  target.status = null

  try {
    const result = await window.api.quickPing(target.host)
    const latency = extractLatency(result)
    target.latency = latency
    target.status = latency !== null ? 'success' : 'failed'
  } catch {
    target.latency = null
    target.status = 'failed'
  } finally {
    target.isPinging = false
  }
}

const pingAll = async () => {
  isPingingAll.value = true
  await Promise.all(targets.map((t) => pingTarget(t)))
  isPingingAll.value = false
}

onMounted(() => {
  setTimeout(pingAll, 100)
})
</script>

<style scoped>
.panel {
  width: 220px;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.3s ease;
}

.panel.collapsed {
  width: 42px;
}

.panel-header {
  padding: 10px 12px;
  background: #252525;
  border-bottom: 1px solid #333;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #00ffcc;
  font-weight: bold;
  font-size: 13px;
  flex-shrink: 0;
  cursor: pointer;
  user-select: none;
}

.panel.collapsed .panel-header {
  border-bottom: none;
  writing-mode: vertical-lr;
  flex: 1;
  justify-content: center;
  gap: 8px;
}

.icon {
  font-size: 14px;
}

.collapse-btn {
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 10px;
  padding: 2px 4px;
  transition: color 0.2s;
}

.collapse-btn:hover {
  color: #00ffcc;
}

.panel.collapsed .collapse-btn {
  writing-mode: horizontal-tb;
  margin-top: 4px;
}

.refresh-btn {
  margin-left: auto;
  background: transparent;
  border: 1px solid #00ffcc;
  color: #00ffcc;
  padding: 3px 10px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.refresh-btn:hover {
  background: #00ffcc;
  color: #000;
}

.refresh-btn:disabled {
  border-color: #555;
  color: #555;
  cursor: not-allowed;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.ping-list {
  padding: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ping-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: #0d0d0d;
  border: 1px solid #333;
  border-radius: 4px;
  transition: all 0.3s;
}

.ping-item.pinging {
  border-color: #ffbd2e;
  animation: pulse 1.5s ease-in-out infinite;
}

.ping-item.success {
  border-color: #27c93f;
}

.ping-item.failed {
  border-color: #ff5f56;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.ping-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.target-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.target-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.target-name {
  color: #00ffcc;
  font-weight: bold;
  font-size: 13px;
}

.target-host {
  color: #666;
  font-size: 10px;
}

.ping-latency {
  text-align: right;
}

.latency-value {
  font-size: 16px;
  font-weight: bold;
}

.latency-good {
  color: #27c93f;
}

.latency-ok {
  color: #ffbd2e;
}

.latency-bad {
  color: #ff5f56;
}

.status {
  color: #888;
  font-size: 12px;
}
</style>
