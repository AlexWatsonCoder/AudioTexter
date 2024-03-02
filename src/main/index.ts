import { app, shell, BrowserWindow, ipcMain, dialog, Notification } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { decode } from 'node-wav'
import { Whisper } from 'smart-whisper'
import fs from 'node:fs'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static-electron'
import ffprobeStatic from 'ffprobe-static-electron'
import { Status, Task } from '../renderer/src/Task'
import fastq from 'fastq'
import type { queue, done, queueAsPromised } from 'fastq'
import { VttCue, WebVtt } from '@audapolis/webvtt-writer'
import { download } from 'electron-dl'
import log from 'electron-log/main'
let mainWindow
const BASE_MODELS_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/'

const mediaFilters = [
  { name: 'Audio', extensions: ['mp3', 'wav', 'aac', 'flac'] },
  { name: 'Video', extensions: ['mp4', 'avi', 'mkv', 'mov', 'wmv'] }
]

const statics = {
  ffmpeg: ffmpegStatic,
  ffprobe: ffprobeStatic
}

const getPath = (type: 'ffprobe' | 'ffmpeg') =>
  process.env.NODE_ENV === 'development'
    ? statics[type].path
    : path.join(
        // `${process.resourcesPath}`,
        // `app.asar.unpacked/node_modules/${type}-static-electron`,
        statics[type].path.replace('app.asar', 'app.asar.unpacked')
      )

console.log('ffmpeg actual path', getPath('ffmpeg'), getPath('ffprobe'))
ffmpeg.setFfmpegPath(getPath('ffmpeg'))
ffmpeg.setFfprobePath(getPath('ffprobe'))

function read_wav(file: string): Float32Array {
  const { sampleRate, channelData } = decode(fs.readFileSync(file))

  if (sampleRate !== 16000) {
    throw new Error(`Invalid sample rate: ${sampleRate}`)
  }
  if (channelData.length !== 1) {
    throw new Error(`Invalid channel count: ${channelData.length}`)
  }

  return channelData[0]
}
function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    center: true,
    // frame: false,
    resizable: false,
    autoHideMenuBar: true,
    title: 'Audio Texter',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function ffprobeAsync(path): Promise<ffmpeg.FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(path, (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

async function transcribe(
  filePath: string,
  modelPath: string,
  id: number,
  pcm: Float32Array,
  duration: number
): Promise<void> {
  try {
    const whisper = new Whisper(modelPath, { gpu: true })
    const task = await whisper.transcribe(pcm, { language: 'auto', n_threads: 2 })
    task.on('transcribed', (result) => {
      // console.log('transcribed', duration, JSON.stringify(result, null, 2))
      mainWindow.webContents.send('progress', {
        id: id,
        progress: Math.min(Math.max(parseFloat((result.to / duration).toFixed(2)), 0), 1)
      })
    })
    task.on('finish', () => {
      mainWindow.webContents.send('status', {
        id: id,
        status: Status.Done
      })
    })
    task.result.then((result) => {
      console.log(result)
      const vtt = new WebVtt('Subtitles are cool')
      result.forEach((item, index) => {
        // 打印每条数据的属性
        vtt.add(
          new VttCue({
            startTime: Number(item.from / 1000),
            endTime: Number(item.to / 1000),
            payload: item.text,
            identifier: (index + 1).toString()
          })
        )
      })
      const srtString = vtt.toString('srt')
      // 使用path模块的extname方法获取当前的后缀名
      const currentExtension = path.extname(filePath)

      // 创建一个新的文件名，将后缀名替换为.srt
      const srtFilePath = filePath.substring(0, filePath.length - currentExtension.length) + '.srt'
      fs.writeFileSync(srtFilePath, srtString)

      mainWindow.webContents.send('subPath', {
        id: id,
        subPath: srtFilePath
      })
    })
    console.log(JSON.stringify(await task.result, null, 2))
  } catch (error) {
    console.error('Error during ffprobe:', error)
    mainWindow.webContents.send('status', {
      id: id,
      status: Status.Error
    })
  }
}

const q: queueAsPromised<Task> = fastq.promise(asyncWorker, 1)
q.drain = () => {
  console.log('Complete all tasks')
}
async function asyncWorker(arg: Task): Promise<void> {
  // No need for a try-catch block, fastq handles errors automatically
  const { filePath, id, duration, modelPath } = arg
  mainWindow.webContents.send('status', {
    id: id,
    status: Status.Processing
  })
  const tempFilePath = path.join(app.getPath('temp'), id + `.wav`)

  const command = ffmpeg(filePath)
    .output(tempFilePath)
    .noVideo() // 相当于 -vn
    .audioCodec('pcm_s16le') // 相当于 -acodec pcm_s16le
    .audioFrequency(16000) // 相当于 -ar 16000
    .audioChannels(1) // 相当于 -ac 1

  command
    .on('end', () => {
      console.log('Video to audio conversion Complete', tempFilePath)
      const pcm = read_wav(tempFilePath)
      transcribe(filePath, modelPath, id, pcm, duration).finally(() => {
        fs.unlink(tempFilePath, (err) => {
          if (err) {
            console.error('Failed to delete temporary files:', err)
          } else {
            console.log('Temporary file deleted successfully.')
          }
        })
      })
    })
    .on('error', (error: Error) => {
      console.error('Video to audio conversion failed', error)
      mainWindow.webContents.send('status', {
        id: id,
        status: Status.Error
      })
    })

  // const task = await whisper.transcribe(pcm, { language: 'auto' })
  // console.log(await task.result)
  return command.run()
}

app.disableHardwareAcceleration()
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('open', async (event, path) => shell.showItemInFolder(path))

  ipcMain.on('transcribe', async (event, arg) => {
    q.push(arg).catch((error) => console.error(error))
  })

  ipcMain.on('pauseAll', async (event, arg) => {
    if (arg == true) {
      q.pause()
    } else {
      q.resume()
    }
  })

  ipcMain.on('check', async (event, arg) => {
    const { filePath } = arg
    // console.log(filePath)
    try {
      const data: ffmpeg.FfprobeData = await ffprobeAsync(filePath)
      const audioStream = data.streams.find((stream) => stream.codec_type === 'audio')
      // console.dir(audioStream)

      if (audioStream!.tags && audioStream!.duration == 'N/A' && audioStream!.tags.DURATION) {
        // 如果有，将tags的DURATION的值赋给duration
        const regex: RegExp = /^(?<hours>\d{2}):(?<minutes>\d{2}):(?<seconds>\d{2}\.\d{9})$/
        const matches = regex.exec(audioStream!.tags.DURATION)
        if (matches && matches.groups) {
          const hours: number = parseFloat(matches.groups['hours'])
          const minutes: number = parseFloat(matches.groups['minutes'])
          const seconds: number = parseFloat(matches.groups['seconds'])
          const totalSeconds: number = hours * 3600 + minutes * 60 + seconds
          audioStream!.duration = totalSeconds.toString()
          console.log(`Total seconds: ${totalSeconds}`)
        }else{
          throw ' Failed to get duration'
        }
        
      }
      log.info(audioStream)
      event.returnValue = audioStream
    } catch (error) {
      console.error('Error during ffprobe:', error)
      log.error('Error during ffprobe:', error)
      event.returnValue = null
    }
  })

  ipcMain.on('getModelPath', async (event, modelFileName) => {
    const modelPath = path.join(app.getPath('downloads'), modelFileName)
    event.returnValue = fs.existsSync(modelPath) ? modelPath : false
  })

  ipcMain.on('download-model', async (event, fileName, model) => {
    await download(BrowserWindow.getFocusedWindow(), BASE_MODELS_URL + fileName, {
      directory: app.getPath('downloads'),
      filename: fileName
    })
      .then((dl) => {
        // window.webContents.send('download complete', dl.getSavePath())
        const myNotification = new Notification({
          title: 'Download completed ',
          body: model + ' Model Download completed'
        })
        myNotification.show()
      })
      .catch((error) => {
        console.error('Download Fail ', BASE_MODELS_URL + fileName, error)
        // window.webContents.send('download complete', dl.getSavePath())
        const myNotification = new Notification({
          title: 'Download Fail ',
          body: model + ' Model Download Fail'
        })
        myNotification.show()
      })
  })

  ipcMain.on('notification', (event, title, body) => {
    const myNotification = new Notification({
      title: title,
      body: body
    })
    myNotification.show()
  })

  ipcMain.on('open-file-dialog', (event) => {
    dialog
      .showOpenDialog({
        title: 'Select File',
        // filters: mediaFilters,
        properties: ['openFile']
      })
      .then((result) => {
        if (result.canceled) {
          return
        }
        // 发送文件路径回渲染进程
        event.sender.send('selected-file', result.filePaths)
      })
      .catch((error) => {
        console.error('Error opening file dialog:', error)
      })
  })

  ipcMain.on('show-download-dialog', (event) => {
    // 显示消息框
    const options = {
      buttons: ['Download Now', 'Not now'],
      defaultId: 0,
      title: 'Download Model',
      message: 'Do you want to download this model now?',
      detail:
        "You haven't downloaded the model yet.Once the download is complete, we will notify you"
    }

    dialog.showMessageBox(mainWindow, options).then((response) => {
      // 根据用户的选择发送响应
      // console.log(response)
      event.returnValue = response
    })
  })

  ipcMain.on('show-dialog', (_event, buttons, title, message, detail) => {
    // 显示消息框
    const options = {
      buttons: buttons,
      defaultId: 0,
      title: title,
      message: message,
      detail: detail
    }
    dialog.showMessageBox(mainWindow, options)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
