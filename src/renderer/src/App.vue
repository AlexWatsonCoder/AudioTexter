<template>
  <HeadWidget :model-path="modelPath" @add-task="onAddTask" />
  <DropBox @update:selected-option="handleSelectedOption" />
  <TaskProvider>
    <TaskItem
      v-for="task in tasks"
      :key="task.id"
      :task="task"
      @remove-task="onRemoveTask"
      @stop-task="onStopTask"
      @start-task="onStartTask"
    />
    <!-- 其他组件 -->
  </TaskProvider>
  <!-- <Versions /> -->
</template>

<script setup lang="ts">
import TaskItem from './components/Task.vue'
// import Versions from './components/Versions.vue'
import HeadWidget from './components/HeadWidget.vue'

import TaskProvider from './components/TaskProvider.vue'
import { Task } from '../src/Task'
import { ref } from 'vue'
import DropBox from './components/DropBox.vue'

// 响应式的任务列表
const tasks = ref<Task[]>([])

const modelPath = ref<string>('');

window.electron.ipcRenderer.on('progress', (_event, arg) => {
  const { id, progress } = arg
  console.log('Update progress', arg)
  const taskIndex = tasks.value.findIndex((task) => task.id === id)
  if (taskIndex !== -1) {
    // 更新任务进度
    tasks.value[taskIndex].progress = progress * 100
  }
})

window.electron.ipcRenderer.on('status', (_event, arg) => {
  const { id, status } = arg
  console.log('Update status', arg)
  const taskIndex = tasks.value.findIndex((task) => task.id === id)
  if (taskIndex !== -1) {
    // 更新状态
    tasks.value[taskIndex].status = status
  }
})

window.electron.ipcRenderer.on('subPath', (_event, arg) => {
  const { id, subPath } = arg
  console.log('Update Subtitle File Path', arg)
  const taskIndex = tasks.value.findIndex((task) => task.id === id)
  if (taskIndex !== -1) {
    // 更新状态
    tasks.value[taskIndex].subPath = subPath
  }
})

// 在主进程创建一个新的任务
const addTask = (newTask: Task) => {
  tasks.value.unshift(newTask)
  // 发送主进程处理
  window.electron.ipcRenderer.send('transcribe', newTask)
}

// 监听来自 HeadWidget 按钮的 'add-task' 事件
const onAddTask = (event: CustomEvent) => {
  const newTask = event.detail
  addTask(newTask)
}

const onRemoveTask = (event: CustomEvent) => {
  const taskId = event.detail
  console.log('taskId remove', taskId)
  const taskIndex = tasks.value.findIndex((task) => task.id === taskId)
  if (taskIndex !== -1) {
    // 更新task List
    tasks.value.splice(taskIndex, 1)
  }
}

const onStopTask = (event: CustomEvent) => {
  const taskId = event.detail
  console.log('taskId stop', taskId)
}

const onStartTask = (event: CustomEvent) => {
  const taskId = event.detail
  console.log('taskId start', taskId)
}

const handleSelectedOption = (selectedOption: {
  label: string
  model: string
  fileName: string
  modelPath: string
}) => {
  modelPath.value = selectedOption.modelPath
  console.log('选中的选项:', selectedOption, modelPath)
  // 在这里处理选中的结构体对象
}
</script>
