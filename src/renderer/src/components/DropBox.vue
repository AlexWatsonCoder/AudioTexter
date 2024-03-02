<template>
  <div class="dropdown">
    <a @click="toggleDropdown">{{ label }}</a>
    <ul v-if="isActive" class="dropdown-menu">
      <li v-for="(model, index) in options" :key="index" @click="selectOption(model)">
        {{ model.label }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const isActive = ref(false)
const emit = defineEmits(['update:selectedOption'])
const label = ref('Select Model')
const options = ref([
  { label: 'Tiny', model: 'tiny', fileName: 'ggml-tiny.bin' },
  { label: 'Base', model: 'base', fileName: 'ggml-base.bin' },
  { label: 'Small', model: 'small', fileName: 'ggml-small.bin' },
  { label: 'Medium', model: 'medium', fileName: 'ggml-medium.bin' },
  { label: 'Large', model: 'large', fileName: 'ggml-large-v3.bin' }
])
const selectedOption = ref('')

const getModelPath = (modelFileName) => {
  return window.electron.ipcRenderer.sendSync('getModelPath', modelFileName)
}

const toggleDropdown = () => {
  isActive.value = !isActive.value
}

const selectOption = (option: { label: string; model: string; fileName: string }) => {
  isActive.value = false
  if (getModelPath(option.fileName) === false) {
    const result = window.electron.ipcRenderer.sendSync('show-download-dialog')
    if (result.response === 0) {
      // 用户选择了“现在下载”，发送事件到主进程以触发下载
      window.electron.ipcRenderer.send('download-model', option.fileName, option.model)
      console.log('download-file', option)
    }
    return
  }
  selectedOption.value = option.model
  // 触发事件并发送选项值
  emit('update:selectedOption', { modelPath: getModelPath(option.fileName), ...option })
  label.value = option.label || 'Select Model'
}
</script>

<style scoped>
.dropdown {
  display: block;
  position: absolute;
  top: 1rem;
  left: 40%;
  width: 8rem;
}
.dropdown a {
  padding: 1rem;
  background-color: #211f26;
  border: 0.2rem;
  align-items: center;
  display: inline-flex;
  border-radius: 0.5rem;
  width: -webkit-fill-available;
  justify-content: center;
}
.dropdown-menu {
  transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  background-color: #2d2937;
  border-radius: 0.5rem;
  padding-inline-start: unset;
  text-align: center;
  & li {
    padding: 5px 10px 5px 5px;
    border-bottom: #918c9e;
    border-width: 1px;
  }
}
</style>
