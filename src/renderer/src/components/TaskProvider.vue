<template>
  <div style="overflow: auto" class="custom-scrollbar">
    <slot />
  </div>
</template>

<script lang="ts">
import { defineComponent, provide, ref } from 'vue'
import { Task } from '../Task'

export default defineComponent({
  setup() {
    const tasks = ref<Task[]>([])
    const updateProgress = (id: number, newProgress: number) => {
      const task = tasks.value.find((p) => p.id === id)
      if (task) {
        task.progress = newProgress
      }
    }

    provide('updateProgress', updateProgress)

    return {
      tasks
    }
  }
})
</script>

<style scoped>
/* 滚动条整体样式 */

</style>
