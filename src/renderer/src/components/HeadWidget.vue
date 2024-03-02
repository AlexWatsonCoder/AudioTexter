<script setup lang="ts">
import IconStart from './IconStart.vue'
import IconSelect from './IconSelect.vue'
import { Status, Task } from '../../src/Task'
import { defineEmits, ref } from 'vue'
import IconStop from './IconStop.vue'

const props = defineProps<{ modelPath: string }>()

const emit = defineEmits(['add-task'])

const addTask = (newTask: Task) => {
  // 触发自定义事件，并将新任务作为事件详情传递
  const event = new CustomEvent('add-task', { detail: newTask })
  emit('add-task', event)
}

const pause = ref(false)

const pauseAll = () => {
  console.log('pauseAll')
  pause.value = !pause.value
  window.electron.ipcRenderer.send('pauseAll', pause.value)
}

window.electron.ipcRenderer.on('selected-file', (event, filePaths) => {
  console.log('Selected file:', filePaths[0]) // 通常用户只选择一个文件
  const audio = event.sender.sendSync('check', {
    filePath: filePaths[0]
  })
  if (audio && audio.duration) {
    console.log('time ', audio.duration)
    addTask({
      id: new Date().getTime(),
      filePath: filePaths[0],
      name: filePaths[0].split(/[\\/]+/).pop(),
      description: 'Waiting....',
      status: Status.Pending,
      duration: audio.duration * 1000,
      modelPath: props.modelPath,
      progress: 0
    })
  } else {
    window.electron.ipcRenderer.send(
      'notification',
      'please check file',
      'The file you selected may not contain audio, please check'
    )
    console.log('请选择正确的文件')
  }

  // 在这里处理文件路径，例如加载文件内容
})

const selectFile = () => {
  if (!props.modelPath) {
    window.electron.ipcRenderer.send(
      'show-dialog',
      ['Close'],
      'select model',
      'Please select a model on the left',
      ''
    )
    return
  }
  window.electron.ipcRenderer.send('open-file-dialog')
}
</script>

<template>
  <div class="header">
    <div class="logo">
      <img src="../assets/logo.png" alt="" style="height: 5rem" />
    </div>
    <div class="right-widget">
      <button class="button" @click="selectFile()">
        <IconSelect style="margin-right: 0.5rem" /> <span>Select File</span>
      </button>
      <button class="button" @click="pauseAll()">
        <IconStop v-show="pause" style="margin-right: 0.5rem" fill="#a5abb6" />
        <span v-show="pause" style="width: 100%">Pause All</span>
        <IconStart v-show="!pause" style="margin-right: 0.5rem" />
        <span v-show="!pause" style="width: 100%">Start All</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.header {
  margin: 0 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.logo {
}

.right-widget {
  margin-left: auto !important;
  align-items: center;
}

.button {
  padding: 1rem 1rem;
  font-size: 1rem;
  color: #ffffffff;
  background-color: #211f26;
  border: 0.2rem;
  align-items: center;
  display: inline-flex;
  border-radius: 0.5rem;
}
.button:first-child {
  margin-right: 2rem;
}
</style>
