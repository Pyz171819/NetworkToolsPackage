<template>
  <div :class="['panel', { collapsed }]">
    <div class="panel-header" @dblclick="collapsed = !collapsed">
      <span class="icon">🖥️</span>
      <span>本机信息</span>
      <button class="collapse-btn" @click="collapsed = !collapsed" :title="collapsed ? '展开' : '收起'">
        {{ collapsed ? '◀' : '▶' }}
      </button>
      <button v-if="!collapsed" class="refresh-btn" :disabled="loading" @click.stop="fetchInfo">
        {{ loading ? '⟳' : '↻' }}
      </button>
    </div>
    <div v-if="!collapsed" class="info-content">
      <div v-if="info" class="info-list">
        <div v-for="(value, key) in info" :key="key" class="info-item">
          <span class="info-label">{{ key }}</span>
          <span class="info-value">{{ value }}</span>
        </div>
      </div>
      <div v-else class="loading">加载中...</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const info = ref(null)
const loading = ref(false)
const collapsed = ref(false)

const fetchInfo = async () => {
  if (!window.api?.getLocalNetworkInfo) return

  loading.value = true
  try {
    info.value = await window.api.getLocalNetworkInfo()
  } catch (error) {
    console.error('获取本机信息失败:', error)
    info.value = { 错误: '无法获取网络信息' }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  setTimeout(fetchInfo, 100)
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

.info-content {
  padding: 12px;
  overflow-y: auto;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px;
  background: #0d0d0d;
  border-radius: 4px;
  border-left: 2px solid #00ffcc;
}

.info-label {
  color: #888;
  font-size: 10px;
  text-transform: uppercase;
}

.info-value {
  color: #fff;
  font-size: 12px;
  word-break: break-all;
}

.loading {
  text-align: center;
  color: #888;
  padding: 20px;
  font-size: 12px;
}
</style>
