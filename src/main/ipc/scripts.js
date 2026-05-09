import { app, dialog, ipcMain, shell } from 'electron'
import { join, dirname } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { createCommandProcess, terminateChildProcess } from '../utils/command'
import { validateScriptInputText, validateScriptPath } from '../utils/validators'

export function registerScriptIpc() {
  const getScriptsPath = () => join(app.getPath('userData'), 'scripts.json')
  let runningScript = null

  ipcMain.handle('open-script-dialog', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择脚本文件',
      filters: [
        { name: '脚本文件', extensions: ['bat', 'py', 'sh'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('run-script', async (_event, scriptPath) => {
    const { scriptPath: normalizedScriptPath, ext } = validateScriptPath(scriptPath)
    const isWindows = process.platform === 'win32'
    const startTime = Date.now()

    if (ext === 'bat') {
      try {
        await shell.openPath(normalizedScriptPath)
        _event.sender.send('script-output', `[System] 已启动: ${normalizedScriptPath}\n`)
        _event.sender.send('script-output', '[System] 脚本在新窗口中运行\n\n')
        _event.sender.send('script-exit', { code: 0, duration: '0' })
        return { success: true }
      } catch (err) {
        _event.sender.send('script-output', `\n[Error] 执行失败: ${err.message}\n`)
        return { success: false }
      }
    }

    let command
    let args
    if (ext === 'py') {
      command = 'python'
      args = ['-u', normalizedScriptPath]
    } else if (ext === 'sh') {
      command = 'bash'
      args = [normalizedScriptPath]
    }

    try {
      const child = createCommandProcess(command, args, {
        cwd: dirname(normalizedScriptPath),
        shell: isWindows,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      })

      runningScript = child

      _event.sender.send('script-output', `[System] 开始执行: ${normalizedScriptPath}\n`)
      _event.sender.send('script-output', `[System] PID: ${child.pid}\n\n`)

      child.stdout.on('data', (buf) => {
        _event.sender.send('script-output', buf.toString('utf-8'))
      })

      child.stderr.on('data', (buf) => {
        _event.sender.send('script-output', buf.toString('utf-8'))
      })

      child.on('close', (code) => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1)
        _event.sender.send('script-output', `\n[System] 执行完毕，退出码: ${code}，耗时: ${duration}s\n`)
        _event.sender.send('script-exit', { code, duration })
        runningScript = null
      })

      child.on('error', (err) => {
        _event.sender.send('script-output', `\n[Error] 执行失败: ${err.message}\n`)
        _event.sender.send('script-exit', { code: -1, duration: '0' })
        runningScript = null
      })

      return { success: true, pid: child.pid }
    } catch (err) {
      _event.sender.send('script-output', `\n[Error] 执行失败: ${err.message}\n`)
      _event.sender.send('script-exit', { code: -1, duration: '0' })
      return { success: false }
    }
  })

  ipcMain.handle('send-script-input', (_event, text) => {
    const inputText = validateScriptInputText(text)
    if (runningScript && runningScript.stdin && !runningScript.stdin.destroyed) {
      runningScript.stdin.write(inputText + '\n')
      return { success: true }
    }
    return { success: false }
  })

  ipcMain.handle('stop-script', () => {
    if (runningScript) {
      terminateChildProcess(runningScript)
      runningScript = null
      return { success: true }
    }
    return { success: false }
  })

  ipcMain.handle('load-scripts', () => {
    const path = getScriptsPath()
    if (!existsSync(path)) return []
    try {
      return JSON.parse(readFileSync(path, 'utf-8'))
    } catch {
      return []
    }
  })

  ipcMain.handle('save-scripts', (_event, scripts) => {
    try {
      writeFileSync(getScriptsPath(), JSON.stringify(scripts, null, 2), 'utf-8')
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}
