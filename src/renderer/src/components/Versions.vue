<script setup>
import { reactive } from 'vue'

const versions = reactive({ ...window.electron.process.versions })
</script>

<template>
  <!-- <ul class="versions">
    <li class="electron-version">Electron {{ versions.electron }}</li>
    <li class="chrome-version">Chromium {{ versions.chrome }}</li>
    <li class="node-version">Node {{ versions.node }}</li>
  </ul> -->
</template>

<style scoped>
.versions {
  margin: 0;
  padding: 0;
  font-family: 'Menlo', 'Lucida Console', monospace;
  display: inline-flex;
  gap: 8px;
  overflow: hidden;
  align-items: center;
}

.versions li {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  font-size: 11px;
  line-height: 1;
  color: #7f8c9d;
  border: 1px solid #243240;
  border-radius: 999px;
  background: rgba(17, 24, 32, 0.78);
  backdrop-filter: blur(18px);
}
</style>
