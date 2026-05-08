<template>
  <div class="system-monitor">
    <div class="monitor-item cpu">
      <div class="monitor-label">
        <span class="monitor-name">CPU</span>
        <span class="monitor-value">{{ cpuUsage }}%</span>
      </div>
      <div class="monitor-meta">核心负载</div>
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{
            width: cpuUsage + '%',
            background:
              cpuUsage > 80
                ? 'linear-gradient(90deg, #ff8c7d 0%, #ff5f56 100%)'
                : 'linear-gradient(90deg, #1de0c1 0%, #22f0ff 100%)'
          }"
        ></div>
      </div>
    </div>
    <div class="monitor-item memory">
      <div class="monitor-label">
        <span class="monitor-name">内存</span>
        <span class="monitor-value">{{ memUsage }}% ({{ usedMem }}/{{ totalMem }} GB)</span>
      </div>
      <div class="monitor-meta">实时占用</div>
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{
            width: memUsage + '%',
            background:
              memUsage > 80
                ? 'linear-gradient(90deg, #ff8c7d 0%, #ff5f56 100%)'
                : 'linear-gradient(90deg, #1de0c1 0%, #22f0ff 100%)'
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
  background: linear-gradient(180deg, rgba(27, 25, 23, 0.88) 0%, rgba(24, 24, 24, 0.9) 100%);
  border: 1px solid rgba(92, 79, 55, 0.35);
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.monitor-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  font-size: 12px;
  color: #98a7b9;
  gap: 12px;
}

.monitor-name {
  color: #d9c6a1;
  font-weight: 700;
}

.monitor-value {
  color: #00ffd9;
  font-weight: bold;
}

.monitor-meta {
  color: #6e7d90;
  font-size: 11px;
  margin-bottom: 10px;
}

.progress-bar {
  height: 10px;
  background: rgba(7, 10, 13, 0.82);
  border-radius: 999px;
  overflow: hidden;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.45);
}

.progress-fill {
  height: 100%;
  transition:
    width 0.3s ease,
    background 0.3s ease;
  border-radius: 999px;
  box-shadow: 0 0 18px rgba(34, 240, 255, 0.18);
}

.monitor-item.memory {
  border-color: rgba(59, 104, 132, 0.34);
}
</style>
