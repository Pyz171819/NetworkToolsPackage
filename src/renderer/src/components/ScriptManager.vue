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
          :class="[
            'script-item',
            {
              active: activeScript?.id === script.id,
              'drag-over': dragOverIndex === index && dragIndex !== index
            }
          ]"
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
            <div v-if="script.tags" class="script-tags">
              <span v-for="tag in script.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
          </div>
          <div class="script-actions">
            <button
              class="run-btn"
              :disabled="running"
              title="运行"
              @click.stop="runScript(script)"
            >
              ▶
            </button>
            <button
              v-if="running && runningScriptId === script.id"
              class="stop-btn"
              title="停止"
              @click.stop="stopScript"
            >
              ■
            </button>
            <button class="del-btn" title="删除" @click.stop="removeScript(script)">✕</button>
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
        <div v-if="running" class="input-bar">
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
let offScriptOutput = null
let offScriptExit = null

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
    output.value = next ? scriptOutputs[next.id] || '' : ''
  }
  await saveScriptList()
}

// 运行脚本
const runScript = async (script) => {
  if (running.value || !window.api?.runScript) return
  running.value = true
  runningScriptId.value = script.id
  switchScript(script)
  output.value += `\n━━━ [${new Date().toLocaleTimeString()}] 运行 ${script.name} ━━━\n`

  offScriptOutput?.()
  offScriptExit?.()

  offScriptOutput = window.api.onScriptOutput((data) => {
    output.value += data
    scriptOutputs[script.id] = output.value
  })

  offScriptExit = window.api.onScriptExit(() => {
    running.value = false
    runningScriptId.value = null
    offScriptOutput?.()
    offScriptExit?.()
    offScriptOutput = null
    offScriptExit = null
  })

  try {
    const result = await window.api.runScript(script.path)
    if (!result || !result.success) {
      output.value += '[Error] 脚本启动失败，请检查文件路径和脚本解释器\n'
      running.value = false
      runningScriptId.value = null
      offScriptOutput?.()
      offScriptExit?.()
      offScriptOutput = null
      offScriptExit = null
    }
  } catch (err) {
    output.value += `[Error] IPC 调用失败: ${err.message}\n`
    running.value = false
    runningScriptId.value = null
    offScriptOutput?.()
    offScriptExit?.()
    offScriptOutput = null
    offScriptExit = null
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
  offScriptOutput?.()
  offScriptExit?.()
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
  background: linear-gradient(180deg, #141b23 0%, #10161d 100%);
  border: 1px solid #253240;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.18);
}

.list-header {
  padding: 12px;
  background: rgba(18, 25, 34, 0.96);
  border-bottom: 1px solid #24303d;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.list-title {
  color: #edf3fa;
  font-weight: bold;
  font-size: 13px;
}

.add-btn {
  background: linear-gradient(180deg, #1382d4 0%, #0c67b6 100%);
  color: #fff;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: bold;
  transition: all 0.2s;
}

.add-btn:hover {
  filter: brightness(1.08);
}

.scripts {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.script-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  border-radius: 8px;
  margin-bottom: 6px;
}

.script-item:hover {
  background: rgba(31, 41, 53, 0.92);
  border-color: #2a3948;
}

.script-item.active {
  background: rgba(14, 50, 76, 0.7);
  border-color: #299de7;
  box-shadow: inset 0 0 0 1px rgba(41, 157, 231, 0.18);
}

.script-item.drag-over {
  border-color: #63d4c8;
  transform: translateY(-1px);
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
  color: #edf3fa;
  font-size: 13px;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.script-path {
  color: #728095;
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
  background: rgba(37, 49, 63, 0.95);
  color: #8e9bad;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  border: 1px solid #2c3a48;
}

.script-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  opacity: 0.92;
}

.script-actions button {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.run-btn {
  background: linear-gradient(180deg, #2bc767 0%, #24a957 100%);
  color: #fff;
}

.run-btn:hover:not(:disabled) {
  filter: brightness(1.08);
}

.run-btn:disabled {
  background: #283340;
  color: #708093;
  cursor: not-allowed;
}

.stop-btn {
  background: linear-gradient(180deg, #e76161 0%, #c74b4b 100%);
  color: #fff;
}

.stop-btn:hover {
  filter: brightness(1.08);
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
  color: #718093;
  border: 1px solid transparent;
}

.del-btn:hover {
  background: rgba(231, 97, 97, 0.12);
  border-color: rgba(231, 97, 97, 0.28);
  color: #ffd7d7;
}

.empty-hint {
  text-align: center;
  color: #738094;
  font-size: 12px;
  padding: 36px 18px;
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
  background: rgba(16, 22, 30, 0.98);
  border: 1px solid #243240;
  border-top: none;
  border-radius: 0 0 10px 10px;
  overflow: hidden;
  flex-shrink: 0;
}

.input-prefix {
  padding: 8px 12px;
  background: rgba(24, 32, 42, 0.95);
  color: #f2c56d;
  font-weight: bold;
  font-size: 12px;
  white-space: nowrap;
  font-family: 'Consolas', 'Courier New', monospace;
  border-right: 1px solid #243240;
}

.input-bar input {
  flex: 1;
  padding: 9px 12px;
  background: transparent;
  color: #eef4fb;
  border: none;
  outline: none;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 13px;
}

.input-bar input::placeholder {
  color: #667588;
}

.input-bar button {
  padding: 0 16px;
  height: 34px;
  background: linear-gradient(180deg, #1382d4 0%, #0c67b6 100%);
  color: white;
  border: none;
  cursor: pointer;
  font-weight: bold;
  font-size: 12px;
  transition: all 0.2s;
}

.input-bar button:hover {
  filter: brightness(1.08);
}
</style>
