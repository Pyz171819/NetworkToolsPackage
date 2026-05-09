import { spawn } from 'child_process'

const outputDecoder =
  process.platform === 'win32' ? new TextDecoder('gb18030', { fatal: false }) : null

export function createCommandProcess(command, args, options = {}) {
  return spawn(command, args, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options
  })
}

export function decodeCommandOutput(chunk) {
  if (!Buffer.isBuffer(chunk)) {
    return String(chunk)
  }

  if (outputDecoder) {
    return outputDecoder.decode(chunk, { stream: true })
  }

  return chunk.toString('utf-8')
}

export function terminateChildProcess(childProcess) {
  if (!childProcess || childProcess.killed) return

  if (process.platform === 'win32' && childProcess.pid) {
    const killer = spawn('taskkill', ['/F', '/T', '/PID', String(childProcess.pid)], {
      windowsHide: true,
      stdio: 'ignore'
    })

    killer.on('error', () => {
      try {
        childProcess.kill()
      } catch {
        // ignore cleanup failure
      }
    })
    return
  }

  try {
    childProcess.kill('SIGTERM')
  } catch {
    // ignore cleanup failure
  }
}

export function runCommand(command, args, timeoutMs = 0, options = {}) {
  return new Promise((resolve, reject) => {
    const childProcess = createCommandProcess(command, args, options)
    let stdout = ''
    let stderr = ''
    let timer = null
    let settled = false

    const finish = (callback) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      callback()
    }

    childProcess.stdout.on('data', (data) => {
      stdout += decodeCommandOutput(data)
    })

    childProcess.stderr.on('data', (data) => {
      stderr += decodeCommandOutput(data)
    })

    childProcess.on('close', (code) => {
      finish(() => {
        if (code === 0) {
          resolve(stdout)
          return
        }
        reject(new Error(stderr || stdout || `命令退出码: ${code}`))
      })
    })

    childProcess.on('error', (error) => {
      finish(() => {
        reject(error)
      })
    })

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        terminateChildProcess(childProcess)
        finish(() => {
          reject(new Error(`命令执行超时: ${command}`))
        })
      }, timeoutMs)
    }
  })
}
