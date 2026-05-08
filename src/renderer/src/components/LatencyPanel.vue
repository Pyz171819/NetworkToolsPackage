<template>
  <div :class="['panel', { collapsed }]">
    <div class="panel-header" @dblclick="collapsed = !collapsed">
      <span class="icon">📡</span>
      <span>延时监控</span>
      <button
        class="collapse-btn"
        :title="collapsed ? '展开' : '收起'"
        @click="collapsed = !collapsed"
      >
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
            >{{ target.latency }}ms</span
          >
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
  width: 300px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.3s ease;
}

.panel.collapsed {
  width: 54px;
}

.panel-header {
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #8ff7df;
  font-weight: bold;
  font-size: 14px;
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
  font-size: 15px;
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
  border: 1px solid rgba(0, 255, 204, 0.72);
  color: #7cefd4;
  width: 40px;
  height: 36px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.refresh-btn:hover {
  background: rgba(0, 255, 204, 0.12);
  color: #dffcf3;
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
  padding: 14px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ping-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 13px;
  background: linear-gradient(180deg, rgba(9, 13, 17, 0.94) 0%, rgba(13, 18, 23, 0.94) 100%);
  border: 1px solid rgba(50, 73, 85, 0.4);
  border-radius: 10px;
  transition: all 0.2s ease;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
}

.ping-item.pinging {
  border-color: rgba(255, 189, 46, 0.72);
  animation: pulse 1.5s ease-in-out infinite;
}

.ping-item.success {
  border-color: rgba(39, 201, 63, 0.72);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.02),
    0 0 0 1px rgba(39, 201, 63, 0.08);
}

.ping-item.failed {
  border-color: rgba(255, 95, 86, 0.7);
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
  gap: 4px;
  min-width: 0;
}

.target-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.target-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.target-name {
  color: #dff6ff;
  font-weight: bold;
  font-size: 13px;
}

.target-host {
  color: #75879a;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ping-latency {
  text-align: right;
}

.latency-value {
  font-size: 15px;
  font-weight: bold;
  display: inline-flex;
  min-width: 62px;
  justify-content: flex-end;
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
