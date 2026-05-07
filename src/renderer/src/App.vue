<template>
  <div class="qhub-container">
    <div class="header">
      <h1>Q-Hub 极客控制台</h1>
      <p class="subtitle">网络诊断舱 - 模块化监控中心</p>
    </div>

    <SystemMonitor
      :cpu-usage="cpuUsage"
      :mem-usage="memUsage"
      :total-mem="totalMem"
      :used-mem="usedMem"
    />

    <div class="tab-navigation">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab-btn', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </div>

    <div class="main-content">
      <LocalInfoPanel />
      <keep-alive>
        <PingPanel v-if="activeTab === 'ping'" />
        <PortScanPanel v-else-if="activeTab === 'portscan'" />
        <TraceroutePanel v-else-if="activeTab === 'traceroute'" />
        <LanScanPanel v-else-if="activeTab === 'lanscan'" />
        <SubnetCalcPanel v-else-if="activeTab === 'subnet'" />
        <ScriptManager v-else-if="activeTab === 'script'" />
      </keep-alive>
      <LatencyPanel />
    </div>

    <Versions />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import SystemMonitor from './components/SystemMonitor.vue'
import LocalInfoPanel from './components/LocalInfoPanel.vue'
import LatencyPanel from './components/LatencyPanel.vue'
import PingPanel from './components/PingPanel.vue'
import PortScanPanel from './components/PortScanPanel.vue'
import TraceroutePanel from './components/TraceroutePanel.vue'
import LanScanPanel from './components/LanScanPanel.vue'
import SubnetCalcPanel from './components/SubnetCalcPanel.vue'
import ScriptManager from './components/ScriptManager.vue'
import Versions from './components/Versions.vue'

// Tab 配置
const tabs = [
  { id: 'ping', label: 'Ping探测', icon: '📡' },
  { id: 'portscan', label: '端口扫描', icon: '🔍' },
  { id: 'traceroute', label: '路由追踪', icon: '🛤️' },
  { id: 'lanscan', label: '局域网扫描', icon: '🌐' },
  { id: 'subnet', label: '子网计算', icon: '🧮' },
  { id: 'script', label: '脚本管理', icon: '📜' }
]

const activeTab = ref('ping')

// 系统资源监控
const cpuUsage = ref(0)
const memUsage = ref(0)
const totalMem = ref('0')
const usedMem = ref('0')
let statsInterval = null

const updateSystemStats = async () => {
  if (!window.api?.getSystemStats) return
  try {
    const stats = await window.api.getSystemStats()
    cpuUsage.value = stats.cpuUsage
    memUsage.value = stats.memUsage
    totalMem.value = stats.totalMem
    usedMem.value = stats.usedMem
  } catch (error) {
    console.error('获取系统状态失败:', error)
  }
}

onMounted(() => {
  updateSystemStats()
  statsInterval = setInterval(updateSystemStats, 2000)
})

onUnmounted(() => {
  if (statsInterval) clearInterval(statsInterval)
})
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  width: 100%;
  height: 100%;
}
</style>

<style scoped>
.qhub-container {
  padding: 15px 10px 10px 10px;
  font-family: 'Consolas', 'Courier New', monospace;
  background-color: #121212;
  color: #e0e0e0;
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  margin-bottom: 15px;
  border-bottom: 1px solid #333;
  padding-bottom: 10px;
  flex-shrink: 0;
}

h1 {
  color: #00ffcc;
  font-size: 22px;
  letter-spacing: 2px;
}

.subtitle {
  color: #888;
  font-size: 13px;
  margin-top: 5px;
}

.tab-navigation {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  padding: 10px 15px;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 4px;
  color: #888;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
}

.tab-btn:hover {
  background: #252525;
  border-color: #00ffcc;
  color: #00ffcc;
}

.tab-btn.active {
  background: #007acc;
  border-color: #007acc;
  color: #fff;
}

.tab-icon {
  font-size: 16px;
}

.tab-label {
  font-weight: bold;
}

.main-content {
  flex: 1;
  display: flex;
  gap: 15px;
  overflow: hidden;
  min-height: 0;
}
</style>
