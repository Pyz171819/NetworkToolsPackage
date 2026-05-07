<script setup>
import { reactive } from 'vue'

const versions = reactive({ ...window.electron.process.versions })
</script>

<template>
  <ul class="versions">
    <!-- <li class="electron-version">Electron v{{ versions.electron }}</li>
    <li class="chrome-version">Chromium v{{ versions.chrome }}</li>
    <li class="node-version">Node v{{ versions.node }}</li> -->
  </ul>
</template>

<style scoped>
.versions {
  position: absolute;
  bottom: 10px;
  margin: 0 auto;
  padding: 10px 0;
  font-family: 'Menlo', 'Lucida Console', monospace;
  display: inline-flex;
  overflow: hidden;
  align-items: center;
  border-radius: 22px;
  background-color: #202127;
  backdrop-filter: blur(24px);
}

.versions li {
  display: block;
  float: left;
  border-right: 1px solid #515c67;
  padding: 0 15px;
  font-size: 12px;
  line-height: 14px;
  opacity: 0.6;
}

.versions li:last-child {
  border: none;
}
</style>
