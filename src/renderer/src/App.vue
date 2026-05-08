<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-top">
        <div class="brand-block">
          <p class="brand-kicker">Local Network Toolkit</p>
          <h1>网络工作台</h1>
        </div>
        <Versions class="brand-versions" />
      </div>

      <nav class="nav-list">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['nav-item', { active: activeTab === tab.id }]"
          @click="activeTab = tab.id"
        >
          <span class="nav-icon">{{ tab.icon }}</span>
          <span class="nav-copy">
            <span class="nav-label">{{ tab.label }}</span>
            <span v-if="tab.id === 'dashboard'" class="nav-desc">{{ tab.short }}</span>
          </span>
        </button>
      </nav>
    </aside>

    <main class="workspace">
      <header class="workspace-header" :class="{ compact: activeTab !== 'dashboard' }">
        <div v-if="activeTab === 'dashboard'">
          <p v-if="activeTab === 'dashboard'" class="workspace-kicker">{{ currentView.kicker }}</p>
          <h2>{{ currentView.title }}</h2>
          <p v-if="activeTab === 'dashboard'" class="workspace-description">
            {{ currentView.description }}
          </p>
        </div>
        <div v-if="activeTab === 'dashboard'" class="header-metrics">
          <div class="metric-pill">
            <span class="metric-label">CPU</span>
            <span class="metric-number">{{ cpuUsage }}%</span>
          </div>
          <div class="metric-pill">
            <span class="metric-label">内存</span>
            <span class="metric-number">{{ memUsage }}%</span>
          </div>
          <div class="metric-pill wide">
            <span class="metric-label">使用中</span>
            <span class="metric-number">{{ usedMem }}/{{ totalMem }} GB</span>
          </div>
        </div>
        <div v-else class="tool-topbar">
          <div class="tool-topbar-main">
            <span class="tool-topbar-icon">{{ currentView.icon }}</span>
            <div class="tool-topbar-copy">
              <p class="tool-topbar-kicker">{{ currentView.kicker }}</p>
              <h2>{{ currentView.title }}</h2>
            </div>
          </div>
          <div class="tool-topbar-actions">
            <button class="ghost-action" @click="activeTab = 'dashboard'">返回总览</button>
            <div class="system-inline">
              <span>CPU {{ cpuUsage }}%</span>
              <span>MEM {{ memUsage }}%</span>
              <span>{{ usedMem }}/{{ totalMem }} GB</span>
            </div>
          </div>
        </div>
      </header>

      <div v-if="activeTab === 'dashboard'" class="dashboard-view">
        <SystemMonitor
          :cpu-usage="cpuUsage"
          :mem-usage="memUsage"
          :total-mem="totalMem"
          :used-mem="usedMem"
        />

        <div class="dashboard-grid">
          <section class="dashboard-main">
            <div class="section-card">
              <div class="section-head">
                <div>
                  <p class="section-kicker">Tools</p>
                  <h3>常用工具</h3>
                </div>
                <span class="section-badge">{{ toolTabs.length }} 个模块</span>
              </div>

              <div class="tool-card-grid">
                <button
                  v-for="tab in toolTabs"
                  :key="tab.id"
                  class="tool-card"
                  @click="activeTab = tab.id"
                >
                  <span class="tool-card-icon">{{ tab.icon }}</span>
                  <div class="tool-card-copy">
                    <span class="tool-card-title">{{ tab.label }}</span>
                    <span class="tool-card-desc">{{ tab.short }}</span>
                  </div>
                </button>
              </div>
            </div>

            <div class="section-card compact">
              <div class="section-head">
                <div>
                  <p class="section-kicker">Workflow</p>
                  <h3>排查顺序</h3>
                </div>
              </div>

              <div class="flow-list">
                <div class="flow-item">
                  <span class="flow-step">01</span>
                  <div>
                    <div class="flow-title">先看本机状态</div>
                    <div class="flow-desc">地址、网卡、资源占用</div>
                  </div>
                </div>
                <div class="flow-item">
                  <span class="flow-step">02</span>
                  <div>
                    <div class="flow-title">再查连通性</div>
                    <div class="flow-desc">Ping、路由追踪</div>
                  </div>
                </div>
                <div class="flow-item">
                  <span class="flow-step">03</span>
                  <div>
                    <div class="flow-title">最后做协议与自动化</div>
                    <div class="flow-desc">端口、TCP、脚本</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside class="dashboard-side">
            <LocalInfoPanel />
            <LatencyPanel />
          </aside>
        </div>
      </div>

      <div v-else class="tool-view">
        <div class="tool-stage">
          <keep-alive>
            <component :is="currentView.component" />
          </keep-alive>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import SystemMonitor from './components/SystemMonitor.vue'
import LocalInfoPanel from './components/LocalInfoPanel.vue'
import LatencyPanel from './components/LatencyPanel.vue'
import PingPanel from './components/PingPanel.vue'
import PortScanPanel from './components/PortScanPanel.vue'
import TraceroutePanel from './components/TraceroutePanel.vue'
import LanScanPanel from './components/LanScanPanel.vue'
import TcpTerminalPanel from './components/TcpTerminalPanel.vue'
import SubnetCalcPanel from './components/SubnetCalcPanel.vue'
import ScriptManager from './components/ScriptManager.vue'
import Versions from './components/Versions.vue'

const tabs = [
  {
    id: 'dashboard',
    label: '总览',
    title: '控制台总览',
    kicker: 'Dashboard',
    short: '首页',
    icon: '◫',
    description: '状态、入口、常用工具。',
    component: null
  },
  {
    id: 'ping',
    label: 'Ping 探测',
    title: 'Ping 探测',
    kicker: 'Connectivity',
    short: '连通性',
    icon: '📡',
    description: '目标可达性与往返时间。',
    component: PingPanel
  },
  {
    id: 'portscan',
    label: '端口扫描',
    title: '端口扫描',
    kicker: 'Ports',
    short: '端口检查',
    icon: '🔍',
    description: '查看端口开放情况。',
    component: PortScanPanel
  },
  {
    id: 'traceroute',
    label: '路由追踪',
    title: '路由追踪',
    kicker: 'Routing',
    short: '路径排查',
    icon: '🛤️',
    description: '查看链路跳点。',
    component: TraceroutePanel
  },
  {
    id: 'lanscan',
    label: '局域网扫描',
    title: '局域网扫描',
    kicker: 'Discovery',
    short: '内网发现',
    icon: '🌐',
    description: '发现当前网段活跃主机。',
    component: LanScanPanel
  },
  {
    id: 'tcpterm',
    label: 'TCP 终端',
    title: 'TCP 终端',
    kicker: 'Socket Debug',
    short: 'TCP 调试',
    icon: '🔌',
    description: '建立连接并收发文本。',
    component: TcpTerminalPanel
  },
  {
    id: 'subnet',
    label: '子网计算',
    title: '子网计算',
    kicker: 'Addressing',
    short: '地址规划',
    icon: '🧮',
    description: '计算网段和地址范围。',
    component: SubnetCalcPanel
  },
  {
    id: 'script',
    label: '脚本管理',
    title: '脚本管理',
    kicker: 'Automation',
    short: '自动化',
    icon: '📜',
    description: '管理并运行常用脚本。',
    component: ScriptManager
  }
]

const activeTab = ref('dashboard')

const currentView = computed(() => tabs.find((tab) => tab.id === activeTab.value) ?? tabs[0])
const toolTabs = computed(() => tabs.filter((tab) => tab.id !== 'dashboard'))
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
body,
#app {
  margin: 0;
  padding: 0;
  overflow: hidden;
  width: 100%;
  height: 100%;
  scrollbar-width: thin;
  scrollbar-color: rgba(88, 111, 136, 0.38) transparent;
}

*::-webkit-scrollbar {
  width: 9px;
  height: 9px;
}

*::-webkit-scrollbar-track {
  background: transparent;
}

*::-webkit-scrollbar-thumb {
  background: rgba(70, 89, 111, 0.18);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

*::-webkit-scrollbar-thumb:hover {
  background: rgba(98, 123, 150, 0.42);
  background-clip: padding-box;
}

*::-webkit-scrollbar-corner {
  background: transparent;
}
</style>

<style scoped>
.app-shell {
  --surface-0: #0a0f14;
  --surface-1: rgba(14, 20, 27, 0.98);
  --surface-2: rgba(18, 25, 34, 0.95);
  --surface-3: rgba(25, 34, 45, 0.92);
  --line-soft: rgba(75, 97, 121, 0.28);
  --line-strong: rgba(90, 117, 145, 0.42);
  --text-main: #edf4fb;
  --text-muted: #8ea0b5;
  background:
    radial-gradient(circle at top left, rgba(30, 134, 224, 0.14), transparent 26%),
    radial-gradient(circle at bottom right, rgba(0, 255, 204, 0.07), transparent 22%),
    linear-gradient(180deg, #101419 0%, #0c1015 52%, #090d12 100%);
  color: var(--text-main);
  width: 100vw;
  height: 100vh;
  display: grid;
  grid-template-columns: 246px minmax(0, 1fr);
  overflow: hidden;
  font-family: 'Consolas', 'Courier New', monospace;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px 14px 14px;
  background: linear-gradient(180deg, rgba(13, 18, 24, 0.98) 0%, rgba(10, 14, 20, 0.98) 100%);
  border-right: 1px solid var(--line-soft);
  box-shadow: inset -1px 0 0 rgba(255, 255, 255, 0.02);
  min-height: 0;
  overflow: hidden;
}

.sidebar-top {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.brand-block {
  padding: 4px 6px 0;
}

.brand-kicker,
.workspace-kicker,
.hero-kicker,
.section-kicker {
  color: #7e92a8;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.brand-block h1 {
  margin-top: 6px;
  font-size: 26px;
  line-height: 1.1;
}

.brand-subtitle {
  margin-top: 6px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
  scrollbar-width: thin;
  scrollbar-color: rgba(88, 111, 136, 0.42) transparent;
}

.nav-list::-webkit-scrollbar {
  width: 8px;
}

.nav-list::-webkit-scrollbar-track {
  background: transparent;
}

.nav-list::-webkit-scrollbar-thumb {
  background: rgba(70, 89, 111, 0.16);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

.nav-list:hover::-webkit-scrollbar-thumb {
  background: rgba(88, 111, 136, 0.38);
  background-clip: padding-box;
}

.nav-list::-webkit-scrollbar-thumb:hover {
  background: rgba(108, 135, 164, 0.54);
  background-clip: padding-box;
}

.nav-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 10px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: linear-gradient(180deg, rgba(28, 38, 50, 0.78) 0%, rgba(20, 28, 38, 0.78) 100%);
  border-color: rgba(74, 97, 122, 0.42);
  transform: translateY(-1px);
}

.nav-item.active {
  background: linear-gradient(180deg, rgba(25, 132, 220, 0.18) 0%, rgba(10, 96, 177, 0.24) 100%);
  border-color: rgba(68, 171, 255, 0.5);
  box-shadow:
    0 10px 22px rgba(9, 82, 145, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.nav-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(26, 36, 47, 0.9);
  border: 1px solid rgba(69, 92, 117, 0.32);
  font-size: 16px;
  flex-shrink: 0;
}

.nav-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.nav-label {
  color: #edf4fb;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
}

.nav-desc {
  color: #7f93a8;
  font-size: 11px;
}

.workspace {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 18px 22px 18px 18px;
  gap: 14px;
}

.workspace-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 2px 2px 0;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(58, 76, 96, 0.24);
  padding-bottom: 14px;
}

.workspace-header h2 {
  margin-top: 4px;
  font-size: 26px;
  line-height: 1.04;
}

.workspace-description {
  margin-top: 6px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
  max-width: 420px;
}

.workspace-header.compact {
  display: block;
  padding-bottom: 10px;
}

.workspace-header.compact h2 {
  margin-top: 0;
  font-size: 22px;
}

.header-metrics {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.metric-pill {
  min-width: 104px;
  padding: 8px 10px;
  background: rgba(17, 24, 32, 0.58);
  border: 1px solid rgba(65, 84, 105, 0.22);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.metric-pill.wide {
  min-width: 180px;
}

.metric-label {
  color: #7f93a8;
  font-size: 11px;
}

.metric-number {
  color: #ecf5ff;
  font-size: 15px;
  font-weight: 700;
}

.tool-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.tool-topbar-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.tool-topbar-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(20, 33, 46, 0.9);
  border: 1px solid rgba(71, 96, 122, 0.34);
  font-size: 18px;
  flex-shrink: 0;
}

.tool-topbar-copy {
  min-width: 0;
}

.tool-topbar-kicker {
  color: #7e92a8;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 3px;
}

.tool-topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.ghost-action {
  height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid rgba(74, 97, 122, 0.3);
  background: rgba(17, 24, 32, 0.56);
  color: #dce6f2;
  cursor: pointer;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  font-weight: 700;
  transition: all 0.2s ease;
}

.ghost-action:hover {
  border-color: rgba(68, 171, 255, 0.42);
  background: rgba(20, 32, 44, 0.86);
}

.system-inline {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid rgba(74, 97, 122, 0.22);
  background: rgba(17, 24, 32, 0.4);
  color: #8fa1b5;
  font-size: 12px;
  white-space: nowrap;
}

.dashboard-view,
.tool-view {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
}

.section-card,
.tool-stage {
  background: linear-gradient(180deg, rgba(18, 25, 34, 0.96) 0%, rgba(14, 20, 27, 0.96) 100%);
  border: 1px solid var(--line-strong);
  border-radius: 16px;
  box-shadow:
    0 12px 26px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.section-head h3 {
  margin-top: 6px;
  font-size: 20px;
}

.tool-card {
  border: 1px solid var(--line-soft);
  background: rgba(13, 18, 25, 0.84);
  color: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tool-card:hover {
  border-color: rgba(68, 171, 255, 0.48);
  background: rgba(19, 30, 41, 0.92);
  transform: translateY(-1px);
}

.dashboard-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) 320px;
  gap: 16px;
}

.dashboard-main,
.dashboard-side {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-card {
  padding: 16px;
}

.section-card.compact {
  padding-top: 16px;
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.section-badge,
.tool-chip {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(34, 121, 196, 0.14);
  border: 1px solid rgba(68, 171, 255, 0.26);
  color: #9ed7ff;
  font-size: 11px;
  font-weight: 700;
}

.tool-chip.subtle {
  background: rgba(31, 42, 55, 0.9);
  border-color: rgba(74, 97, 122, 0.3);
  color: #8fa1b5;
}

.tool-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.tool-card {
  border-radius: 14px;
  padding: 14px;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  text-align: left;
}

.tool-card-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  background: rgba(23, 34, 45, 0.94);
  border: 1px solid rgba(74, 97, 122, 0.28);
}

.tool-card-title {
  color: #eef4fb;
  font-size: 14px;
  font-weight: 700;
}

.tool-card-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.tool-card-desc {
  color: #8698ab;
  font-size: 11px;
  line-height: 1.45;
}

.flow-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.flow-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid rgba(66, 84, 105, 0.22);
}

.flow-item:first-child {
  border-top: none;
  padding-top: 0;
}

.flow-step {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(17, 95, 165, 0.16);
  color: #9ed7ff;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.flow-title {
  color: #eef4fb;
  font-size: 13px;
  font-weight: 700;
}

.flow-desc {
  margin-top: 4px;
  color: #8698ab;
  font-size: 11px;
  line-height: 1.45;
}

.tool-stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
  overflow: hidden;
}

:deep(.panel) {
  flex: 1;
  min-height: 0;
  background: linear-gradient(180deg, rgba(20, 27, 35, 0.98) 0%, rgba(16, 22, 29, 0.98) 100%);
  border: 1px solid var(--line-strong);
  border-radius: 16px;
  box-shadow:
    0 18px 36px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(8px);
}

:deep(.panel-header) {
  background: linear-gradient(180deg, rgba(18, 25, 34, 0.98) 0%, rgba(15, 21, 29, 0.98) 100%);
  border-bottom-color: rgba(70, 89, 111, 0.38);
  color: #e4ecf5;
}

:deep(.refresh-btn),
:deep(.collapse-btn) {
  transition: all 0.2s ease;
}

@media (max-width: 1320px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .dashboard-side {
    flex-direction: row;
  }
}

@media (max-width: 1120px) {
  .app-shell {
    grid-template-columns: 210px minmax(0, 1fr);
  }

  .workspace-header {
    flex-direction: column;
  }

  .tool-topbar {
    flex-direction: column;
    align-items: stretch;
  }

  .tool-topbar-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 920px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    border-right: none;
    border-bottom: 1px solid var(--line-soft);
    padding-bottom: 12px;
  }

  .nav-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .tool-card-grid {
    grid-template-columns: 1fr;
  }

  .dashboard-side {
    flex-direction: column;
  }
}
</style>
