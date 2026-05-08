<template>
  <div :class="['panel', { collapsed }]">
    <div class="panel-header" @dblclick="collapsed = !collapsed">
      <span class="icon">🖥️</span>
      <span>本机信息</span>
      <button
        class="collapse-btn"
        :title="collapsed ? '展开' : '收起'"
        @click="collapsed = !collapsed"
      >
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
  width: 320px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition:
    width 0.3s ease,
    box-shadow 0.2s ease;
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

.info-content {
  padding: 14px;
  overflow-y: auto;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px 13px;
  background: linear-gradient(180deg, rgba(10, 14, 18, 0.92) 0%, rgba(13, 17, 22, 0.92) 100%);
  border-radius: 10px;
  border: 1px solid rgba(43, 78, 92, 0.34);
  border-left: 3px solid #00ffcc;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
}

.info-label {
  color: #8ea1b4;
  font-size: 11px;
  text-transform: uppercase;
}

.info-value {
  color: #f3f8fd;
  font-size: 13px;
  font-weight: 700;
  word-break: break-all;
}

.loading {
  text-align: center;
  color: #888;
  padding: 20px;
  font-size: 12px;
}
</style>
