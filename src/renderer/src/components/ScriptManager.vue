<template>
  <div class="script-manager">
    <!-- 左侧脚本列表 -->
    <div class="script-list">
      <div class="list-header">
        <span class="list-title">脚本库</span>
        <button class="add-btn" @click="addScript">+ 添加</button>
      </div>

      <div class="scripts">
        <div
          v-for="(script, index) in scripts"
          :key="script.id"
          draggable="true"
          :class="['script-item', {
            active: activeScript?.id === script.id,
            'drag-over': dragOverIndex === index && dragIndex !== index
          }]"
          @click="switchScript(script)"
          @dragstart="onDragStart(index, $event)"
          @dragover.prevent="onDragOver(index)"
          @dragenter.prevent
          @drop="onDrop(index)"
          @dragend="onDragEnd"
        >
          <div class="script-info">
            <div class="script-name">{{ script.name }}</div>
            <div class="script-path" :title="script.path">{{ script.path }}</div>
            <div class="script-tags" v-if="script.tags">
              <span v-for="tag in script.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
          </div>
          <div class="script-actions">
            <button
              class="run-btn"
              :disabled="running"
              @click.stop="runScript(script)"
              title="运行"
            >▶</button>
            <button
              class="stop-btn"
              v-if="running && runningScriptId === script.id"
              @click.stop="stopScript"
              title="停止"
            >■</button>
            <button
              class="del-btn"
              @click.stop="removeScript(script)"
              title="删除"
            >✕</button>
          </div>
        </div>

        <div v-if="scripts.length === 0" class="empty-hint">
          点击"添加"选择 .bat / .py / .sh 脚本文件
        </div>
      </div>
    </div>

    <!-- 右侧终端输出 -->
    <div class="script-output">
      <div class="output-wrapper">
        <TerminalView title="Terminal - 脚本输出" :output="output" @clear="output = ''" />
        <div class="input-bar" v-if="running">
          <span class="input-prefix">stdin &gt;</span>
          <input
            v-model="stdinInput"
            type="text"
            placeholder="输入内容后回车发送（如密码）"
            @keyup.enter="sendInput"
          />
          <button @click="sendInput">发送</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import TerminalView from './TerminalView.vue'

const scripts = ref([])
const activeScript = ref(null)
const output = ref('')
const running = ref(false)
const runningScriptId = ref(null)
const stdinInput = ref('')

// 拖拽排序
const dragIndex = ref(null)
const dragOverIndex = ref(null)

const onDragStart = (index, event) => {
  dragIndex.value = index
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', index.toString())
}

const onDragOver = (index) => {
  dragOverIndex.value = index
}

const onDrop = (dropIdx) => {
  if (dragIndex.value === null || dragIndex.value === dropIdx) return
  const items = [...scripts.value]
  const [moved] = items.splice(dragIndex.value, 1)
  items.splice(dropIdx, 0, moved)
  scripts.value = items
  saveScriptList()
}

const onDragEnd = () => {
  dragIndex.value = null
  dragOverIndex.value = null
}

// 每个脚本独立的输出记录
const scriptOutputs = reactive({})

// 切换脚本时恢复对应输出
const switchScript = (script) => {
  // 保存当前输出
  if (activeScript.value) {
    scriptOutputs[activeScript.value.id] = output.value
  }
  activeScript.value = script
  // 恢复目标脚本的输出
  output.value = scriptOutputs[script.id] || ''
}

// 加载脚本列表
const loadScriptList = async () => {
  if (!window.api?.loadScripts) return
  scripts.value = await window.api.loadScripts()
}

// 保存脚本列表
const saveScriptList = async () => {
  if (!window.api?.saveScripts) return
  const plain = JSON.parse(JSON.stringify(scripts.value))
  await window.api.saveScripts(plain)
}

// 添加脚本
const addScript = async () => {
  if (!window.api?.openScriptDialog) return
  const filePath = await window.api.openScriptDialog()
  if (!filePath) return

  if (scripts.value.some((s) => s.path === filePath)) {
    output.value += `[System] 脚本已存在: ${filePath}\n`
    return
  }

  const name = filePath.split(/[\\/]/).pop()
  const script = {
    id: Date.now().toString(),
    name,
    path: filePath,
    tags: [],
    addedAt: new Date().toISOString()
  }

  scripts.value.push(script)
  switchScript(script)
  await saveScriptList()
}

// 删除脚本
const removeScript = async (script) => {
  delete scriptOutputs[script.id]
  scripts.value = scripts.value.filter((s) => s.id !== script.id)
  if (activeScript.value?.id === script.id) {
    const next = scripts.value[0] || null
    activeScript.value = next
    output.value = next ? (scriptOutputs[next.id] || '') : ''
  }
  await saveScriptList()
}



// 运行脚本
const runScript = async (script) => {
  if (running.value || !window.api?.runScript) return
  running.value = true
  runningScriptId.value = script.id
  switchScript(script)
  output.value = ''

  // 清除旧的监听，注册新的
  window.api?.offScriptEvents()

  window.api.onScriptOutput((data) => {
    output.value += data
    scriptOutputs[script.id] = output.value
  })

  window.api.onScriptExit(() => {
    running.value = false
    runningScriptId.value = null
    window.api?.offScriptEvents()
  })

  try {
    const result = await window.api.runScript(script.path)
    if (!result || !result.success) {
      output.value += '[Error] 脚本启动失败，请检查文件路径和脚本解释器\n'
      running.value = false
      runningScriptId.value = null
      window.api?.offScriptEvents()
    }
  } catch (err) {
    output.value += `[Error] IPC 调用失败: ${err.message}\n`
    running.value = false
    runningScriptId.value = null
    window.api?.offScriptEvents()
  }
}

// 停止脚本
const stopScript = async () => {
  if (!window.api?.stopScript) return
  await window.api.stopScript()
}

// 发送输入到脚本 stdin
const sendInput = async () => {
  if (!stdinInput.value || !window.api?.sendScriptInput) return
  await window.api.sendScriptInput(stdinInput.value)
  stdinInput.value = ''
}

onMounted(() => {
  loadScriptList()
})

onUnmounted(() => {
  window.api?.offScriptEvents()
})
</script>

<style scoped>
.script-manager {
  flex: 1;
  display: flex;
  gap: 12px;
  min-height: 0;
}

.script-list {
  width: 280px;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

.list-header {
  padding: 10px 12px;
  background: #252525;
  border-bottom: 1px solid #333;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.list-title {
  color: #00ffcc;
  font-weight: bold;
  font-size: 13px;
}

.add-btn {
  background: #007acc;
  color: #fff;
  border: none;
  padding: 4px 12px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  font-weight: bold;
  transition: all 0.2s;
}

.add-btn:hover {
  background: #0098ff;
}

.scripts {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0;
}

.script-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  gap: 8px;
  cursor: pointer;
  transition: background 0.2s;
  border-left: 3px solid transparent;
}

.script-item:hover {
  background: #222;
}

.script-item.active {
  background: #1a2a3a;
  border-left-color: #00ffcc;
}

.script-item.drag-over {
  border-top: 2px solid #00ffcc;
}

.script-item[draggable='true'] {
  cursor: grab;
}

.script-item[draggable='true']:active {
  cursor: grabbing;
  opacity: 0.5;
}

.script-info {
  flex: 1;
  min-width: 0;
}

.script-name {
  color: #e0e0e0;
  font-size: 13px;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.script-path {
  color: #666;
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.script-tags {
  display: flex;
  gap: 4px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.tag {
  background: #2a2a3a;
  color: #888;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid #333;
}

.script-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.script-actions button {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.run-btn {
  background: #27c93f;
  color: #fff;
}

.run-btn:hover:not(:disabled) {
  background: #30d94a;
}

.run-btn:disabled {
  background: #333;
  color: #666;
  cursor: not-allowed;
}

.stop-btn {
  background: #ff5f56;
  color: #fff;
}

.stop-btn:hover {
  background: #ff7b73;
}

.tag-btn {
  background: #333;
  color: #888;
}

.tag-btn:hover {
  background: #444;
  color: #ccc;
}

.del-btn {
  background: transparent;
  color: #666;
}

.del-btn:hover {
  background: #ff5f56;
  color: #fff;
}

.empty-hint {
  text-align: center;
  color: #555;
  font-size: 12px;
  padding: 30px 16px;
  line-height: 1.6;
}

.script-output {
  flex: 1;
  display: flex;
  min-width: 0;
}

.output-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.input-bar {
  display: flex;
  align-items: center;
  background: #1e1e1e;
  border: 1px solid #333;
  border-top: none;
  border-radius: 0 0 6px 6px;
  overflow: hidden;
  flex-shrink: 0;
}

.input-prefix {
  padding: 8px 12px;
  background: #252525;
  color: #ffbd2e;
  font-weight: bold;
  font-size: 12px;
  white-space: nowrap;
  font-family: 'Consolas', 'Courier New', monospace;
}

.input-bar input {
  flex: 1;
  padding: 8px 10px;
  background: transparent;
  color: #fff;
  border: none;
  outline: none;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 13px;
}

.input-bar button {
  padding: 0 16px;
  height: 34px;
  background: #007acc;
  color: white;
  border: none;
  cursor: pointer;
  font-weight: bold;
  font-size: 12px;
  transition: all 0.2s;
}

.input-bar button:hover {
  background: #0098ff;
}
</style>
