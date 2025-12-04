<!-- TextEditor.vue - 新增组件 -->
<template>
  <div class="text-editor-overlay" @click="handleOverlayClick">
    <div 
      class="text-editor-container" 
      :style="{
        left: position.x + 'px',
        top: position.y + 'px',
        width: width + 'px'
      }"
      @click.stop
    >
      <textarea
        ref="textareaRef"
        v-model="textContent"
        class="text-editor"
        :style="{ 
          fontFamily: fontFamily,
          fontSize: fontSize + 'px',
          color: color,
          backgroundColor: backgroundColor
        }"
        @keydown="handleKeydown"
        @blur="handleBlur"
        @input="adjustHeight"
      ></textarea>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'

const props = defineProps({
  initialText: { type: String, default: '' },
  position: { type: Object, required: true },
  fontFamily: { type: String, default: 'Arial' },
  fontSize: { type: Number, default: 16 },
  color: { type: String, default: '#000000' },
  backgroundColor: { type: String, default: 'transparent' },
  width: { type: Number, default: 200 }
})

const emit = defineEmits(['save', 'cancel'])

const textContent = ref(props.initialText)
const textareaRef = ref(null)

onMounted(() => {
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.focus()
      // 将光标移到末尾
      textareaRef.value.setSelectionRange(
        textContent.value.length, 
        textContent.value.length
      )
      adjustHeight()
    }
  })
})

function adjustHeight() {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
    textareaRef.value.style.height = textareaRef.value.scrollHeight + 'px'
  }
}

function handleKeydown(event) {
  if (event.key === 'Enter' && event.ctrlKey) {
    event.preventDefault()
    saveText()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelEdit()
  }
}

function handleBlur() {
  saveText()
}

function handleOverlayClick() {
  saveText()
}

function saveText() {
  emit('save', textContent.value)
}

function cancelEdit() {
  emit('cancel')
}
</script>

<style scoped>
.text-editor-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2000;
}

.text-editor-container {
  position: absolute;
  min-width: 100px;
  min-height: 30px;
}

.text-editor {
  width: 100%;
  min-height: 30px;
  padding: 5px;
  border: 1px solid #409eff;
  outline: none;
  resize: none;
  overflow: hidden;
  font-family: Arial;
  font-size: 16px;
  line-height: 1.3;
  box-sizing: border-box;
  background: white;
}

.text-editor:focus {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}
</style>