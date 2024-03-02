<script setup lang="ts">
import IconVideo from './IconVideo.vue'
import IconClose from './IconClose.vue'
import IconStop from './IconStop.vue'
// import IconRefresh from './IconRefresh.vue'
import { Task, Status } from '../Task'
import IconStart from './IconStart.vue'
import IconFile from './IconFile.vue'

const { task } = defineProps<{
  task: Task
}>()

const emit = defineEmits(['remove-task', 'stop-task', 'start-task'])

const removeFormList = (taskId: number) => {
  if (task.status == Status.Processing) {
    return
  }
  // 触发自定义事件，并将新任务作为事件详情传递
  const event = new CustomEvent('remove-task', { detail: taskId })
  emit('remove-task', event)
}

const stopFormList = (taskId: number) => {
  // 触发自定义事件，并将新任务作为事件详情传递
  const event = new CustomEvent('stop-task', { detail: taskId })
  emit('stop-task', event)
}

const startFormList = (taskId: number) => {
  // 触发自定义事件，并将新任务作为事件详情传递
  const event = new CustomEvent('start-task', { detail: taskId })
  emit('start-task', event)
}

const openSubFile = (subPath: string) => {
  window.electron.ipcRenderer.send('open', subPath)
}
</script>

<template>
  <div class="task">
    <div class="task-content">
      <div class="task-info">
        <IconVideo class="task-type" @click="openSubFile(task.filePath)"/>
        <div style="flex: 1">
          <h2>[ {{ task.id }} ] {{ task.name }}</h2>
          <div class="task-progress">
            <div
              class="progress-bar"
              :style="{
                width: task.progress + '%',
                backgroundColor: task.status == Status.Done ? `#42d39259` : `#6c41c2`
              }"
            ></div>
          </div>
        </div>
      </div>
      <div class="task-control" style="padding-right: 2rem">
        <span v-show="task.status == Status.Processing" style="color: #42d3927d; width: 3rem"
          >{{ task.progress }}%</span
        >
        <IconStart
          v-show="task.status == Status.Done || task.status == Status.Error"
          title="click"
          :fill="task.status == Status.Processing ? `#a5abb6` : `#323234`"
          @click="startFormList(task.id)"
        />
        <IconStop
          v-show="task.status == Status.Processing"
          title="click"
          :fill="task.status == Status.Processing ? `#a5abb6` : `#323234`"
          @click="stopFormList(task.id)"
        />
        <IconFile
          :fill="task.status == Status.Done ? `#a5abb6` : `#323234`"
          @click="openSubFile(task.subPath)"
        />

        <IconClose
          title="click"
          :fill="task.status == Status.Done ? `#a5abb6` : `#323234`"
          @click="removeFormList(task.id)"
        />

        <!-- <IconRefresh v-if="task.status == Status.Done" /> -->
      </div>
    </div>
  </div>
</template>

<style scoped>
.task {
  display: block;
  margin: 10px 1.5rem;
  background-color: #211f26;
  padding: 15px 20px;
  border-radius: 0.5rem;
}
.task-type {
  margin-right: 10px;
}
.task-info {
  display: flex;
  align-items: center;
  flex: 1;
}
.task-info h2 {
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.task-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.task-control {
  display: flex;
  align-items: center;
}
.task-control > :not(:last-child) {
  margin-right: 1rem;
}

.task-progress {
  height: 10px;
  margin-top: 8px;
  margin-right: 5rem;
  overflow: hidden;
  border-radius: 0.75rem;
  display: flex;
  background-color: #2b2831;
  width: auto;
}
.progress-bar {
  animation-duration: 5s;
  animation-name: myanimation;
  transition: all 5s ease 0s;
  border-radius: 0.25rem;
  /* background-color: #6c41c2 !important; */
}
</style>
