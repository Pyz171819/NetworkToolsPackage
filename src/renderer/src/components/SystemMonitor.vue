<template>
  <div class="system-monitor">
    <div class="monitor-item">
      <div class="monitor-label">
        <span>CPU</span>
        <span class="monitor-value">{{ cpuUsage }}%</span>
      </div>
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{
            width: cpuUsage + '%',
            backgroundColor: cpuUsage > 80 ? '#ff5f56' : '#00ffcc'
          }"
        ></div>
      </div>
    </div>
    <div class="monitor-item">
      <div class="monitor-label">
        <span>内存</span>
        <span class="monitor-value">{{ memUsage }}% ({{ usedMem }}/{{ totalMem }} GB)</span>
      </div>
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{
            width: memUsage + '%',
            backgroundColor: memUsage > 80 ? '#ff5f56' : '#00ffcc'
          }"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  cpuUsage: { type: Number, default: 0 },
  memUsage: { type: Number, default: 0 },
  totalMem: { type: String, default: '0' },
  usedMem: { type: String, default: '0' }
})
</script>

<style scoped>
.system-monitor {
  display: flex;
  gap: 15px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.monitor-item {
  flex: 1;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 10px;
}

.monitor-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 12px;
  color: #888;
}

.monitor-value {
  color: #00ffcc;
  font-weight: bold;
}

.progress-bar {
  height: 6px;
  background: #0d0d0d;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #00ffcc;
  transition:
    width 0.3s ease,
    background-color 0.3s ease;
  border-radius: 3px;
}
</style>
