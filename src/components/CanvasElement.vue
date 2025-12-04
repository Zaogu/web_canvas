<template>
  <div
    class="canvas-element"
    :class="{
      selected: isSelected,
      [element.type]: true,
      [element.shapeType]: element.type === 'shape',
      editing: isEditing
    }"
    :style="elementStyle"
    @mousedown="handleMouseDown"
    @dblclick="handleDoubleClick"
  >
    <!-- 形状元素 -->
    <div
      v-if="element.type === 'shape'"
      class="shape-element"
      :class="element.shapeType"
      :style="shapeStyle"
    ></div>
    
   <!-- 文本元素 - 显示模式 -->
  <div 
    v-else-if="element.type === 'text' && !isEditing" 
    class="text-element"
    :style="textStyle"
    @dblclick.stop="handleTextDoubleClick"
  >
    <div class="text-display-wrapper">
      <div class="text-display" :style="textContentStyle" v-html="element.text"></div>
    </div>
  </div>
    <!-- 文本元素 - 编辑模式 -->
    <div 
      v-else-if="element.type === 'text' && isEditing" 
      class="text-edit-container"
      :style="editContainerStyle"
    >
      <RichTextEditor
        ref="richTextEditor"
        :html="element.text"
        :width="element.width"
        :height="element.height"
        @update="updateHtml"
        @exit="finishEditing"
      />
    </div>
    
    <!-- 图片元素 -->
    <div v-else-if="element.type === 'image'" class="image-element">
      <img :src="element.image?.url" :style="imageStyle" />
      <div v-if="!element.image?.url" class="image-placeholder">
        🖼️ 图片
      </div>
    </div>
    
    <!-- 选中状态控件 -->
    <div v-if="isSelected && !isEditing" class="selection-controls">
      <div class="resize-handle nw" @mousedown="startResize($event, 'nw')"></div>
      <div class="resize-handle ne" @mousedown="startResize($event, 'ne')"></div>
      <div class="resize-handle sw" @mousedown="startResize($event, 'sw')"></div>
      <div class="resize-handle se" @mousedown="startResize($event, 'se')"></div>
      <div class="rotate-handle" @mousedown="startRotate($event)">⟳</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import RichTextEditor from './RichTextEditor.vue'

function handleTextSelect(data) {
  // 传递编辑器实例和方法给浮动工具栏
  if (data && richTextEditor.value) {
    data.editor = richTextEditor.value.editor
    data.editorMethods = {
      toggleBold: richTextEditor.value.toggleBold,
      toggleItalic: richTextEditor.value.toggleItalic,
      toggleUnderline: richTextEditor.value.toggleUnderline,
      toggleStrike: richTextEditor.value.toggleStrike,
      setColor: richTextEditor.value.setColor,
      setFontFamily: richTextEditor.value.setFontFamily
    }
  }
  emit('textSelect', data)
}

const props = defineProps({
  element: {
    type: Object,
    required: true
  },
  isSelected: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['mousedown', 'update:element', 'resize', 'textSelect'])

/* ---------- 状态 ---------- */
const isEditing = ref(false)
const isResizing = ref(false)
const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0 })
const resizeDirection = ref('')
const isRotating = ref(false)
const rotateStart = ref({ x: 0, y: 0, angle: 0 })
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })

const richTextEditor = ref(null)

/* ---------- 计算属性 ---------- */
const elementStyle = computed(() => {
  const style = {
    left: `${props.element.x}px`,
    top: `${props.element.y}px`,
    width: props.element.width ? `${props.element.width}px` : 'auto',
    height: props.element.height ? `${props.element.height}px` : 'auto',
    transform: `rotate(${props.element.rotate || 0}deg)`,
    transformOrigin: 'center',
    zIndex: isEditing.value ? 1000 : 'auto'
  }
  
  return style
})

const editContainerStyle = computed(() => {
  return {
    width: '100%',
    height: '100%',
    position: 'relative',
    zIndex: 1001
  }
})

const shapeStyle = computed(() => {
  const { backgroundColor, borderWidth, borderColor } = props.element
  return {
    width: '100%',
    height: '100%',
    backgroundColor,
    border: borderWidth ? `${borderWidth}px solid ${borderColor}` : 'none'
  }
})

const imageStyle = computed(() => {
  const { filter, opacity } = props.element
  return {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    filter,
    opacity
  }
})

const textStyle = computed(() => {
  return {
    width: '100%',
    height: '100%',
    backgroundColor: props.element.backgroundColor || 'transparent',
    position: 'relative'
  }
})

const textContentStyle = computed(() => {
  return {
    width: '100%',
    minHeight: '100%',
    padding: '8px',
    boxSizing: 'border-box',
    fontFamily: props.element.fontFamily || 'Arial',
    fontSize: (props.element.fontSize || 16) + 'px',
    color: props.element.color || '#000000',
    lineHeight: '1.4',
    wordBreak: 'break-word',
    whiteSpace: 'normal', // 改为 normal 而不是 pre-wrap
    overflow: 'hidden', // 超出部分隐藏
    textAlign: 'left',
    display: 'block'
  }
})
/* ---------- 方法 ---------- */
function handleMouseDown(event) {
  // 文本元素在编辑模式下完全阻止事件传播
  if (props.element.type === 'text' && isEditing.value) {
    event.stopPropagation()
    return
  }
  
  // 只有非文本元素或文本元素非编辑模式才触发选择
  if (props.element.type !== 'text' || !isEditing.value) {
    emit('mousedown', event)
  }
}

function handleDoubleClick(event) {
  if (props.element.type === 'text') {
    event.stopPropagation()
    event.preventDefault()
    startTextEditing()
  }
}

function handleTextDoubleClick(event) {
  event.stopPropagation()
  event.preventDefault()
  startTextEditing()
}

function startTextEditing() {
  isEditing.value = true
  // 立即停止任何正在进行的拖拽
  stopDrag()
  
  nextTick(() => {
    // 确保富文本编辑器获得焦点
    if (richTextEditor.value) {
      richTextEditor.value.focus()
    }
  })
}

function updateHtml(html) {
  emit('update:element', { ...props.element, text: html })
}

function finishEditing(submit) {
  isEditing.value = false
  // 确保停止拖拽
  stopDrag()
  emit('textSelect', null)
}

function startDrag(event) {
  // 如果正在编辑，禁止拖拽
  if (isEditing.value) {
    event.stopPropagation()
    return
  }

  event.stopPropagation()
  isDragging.value = true
  dragStart.value = {
    x: event.clientX,
    y: event.clientY,
    elementX: props.element.x,
    elementY: props.element.y
  }

  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
}

function handleDrag(event) {
  if (!isDragging.value) return
  
  const deltaX = event.clientX - dragStart.value.x
  const deltaY = event.clientY - dragStart.value.y
  
  const newX = Math.round(dragStart.value.elementX + deltaX)
  const newY = Math.round(dragStart.value.elementY + deltaY)
  
  emit('update:element', {
    ...props.element,
    x: newX,
    y: newY
  })
}

function stopDrag() {
  if (isDragging.value) {
    isDragging.value = false
    document.removeEventListener('mousemove', handleDrag)
    document.removeEventListener('mouseup', stopDrag)
  }
}

function startResize(event, direction) {
  event.stopPropagation()
  event.preventDefault()
  
  isResizing.value = true
  resizeDirection.value = direction
  resizeStart.value = {
    x: event.clientX,
    y: event.clientY,
    width: props.element.width || 100,
    height: props.element.height || 50,
    elementX: props.element.x,
    elementY: props.element.y
  }
  
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
}

function handleResize(event) {
  if (!isResizing.value) return
  
  const deltaX = event.clientX - resizeStart.value.x
  const deltaY = event.clientY - resizeStart.value.y
  
  let newWidth = resizeStart.value.width
  let newHeight = resizeStart.value.height
  let newX = resizeStart.value.elementX
  let newY = resizeStart.value.elementY
  
  switch (resizeDirection.value) {
    case 'se':
      newWidth = Math.max(20, resizeStart.value.width + deltaX)
      newHeight = Math.max(20, resizeStart.value.height + deltaY)
      break
    case 'sw':
      newWidth = Math.max(20, resizeStart.value.width - deltaX)
      newHeight = Math.max(20, resizeStart.value.height + deltaY)
      newX = resizeStart.value.elementX + deltaX
      break
    case 'ne':
      newWidth = Math.max(20, resizeStart.value.width + deltaX)
      newHeight = Math.max(20, resizeStart.value.height - deltaY)
      newY = resizeStart.value.elementY + deltaY
      break
    case 'nw':
      newWidth = Math.max(20, resizeStart.value.width - deltaX)
      newHeight = Math.max(20, resizeStart.value.height - deltaY)
      newX = resizeStart.value.elementX + deltaX
      newY = resizeStart.value.elementY + deltaY
      break
  }
  
  const updates = {
    ...props.element,
    width: Math.round(newWidth),
    height: Math.round(newHeight)
  }
  
  if (resizeDirection.value.includes('w')) {
    updates.x = Math.round(newX)
  }
  if (resizeDirection.value.includes('n')) {
    updates.y = Math.round(newY)
  }
  
  emit('update:element', updates)
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  emit('resize')
}

function startRotate(event) {
  event.stopPropagation()
  event.preventDefault()
  
  isRotating.value = true
  
  const elementRect = event.currentTarget.parentElement.getBoundingClientRect()
  const centerX = elementRect.left + elementRect.width / 2
  const centerY = elementRect.top + elementRect.height / 2
  
  const startAngle = Math.atan2(
    event.clientY - centerY,
    event.clientX - centerX
  )
  
  rotateStart.value = {
    x: event.clientX,
    y: event.clientY,
    angle: props.element.rotate || 0,
    startAngle: startAngle,
    centerX,
    centerY
  }
  
  document.addEventListener('mousemove', handleRotate)
  document.addEventListener('mouseup', stopRotate)
}

function handleRotate(event) {
  if (!isRotating.value) return
  
  const { centerX, centerY, startAngle, angle: startRotateAngle } = rotateStart.value
  
  const currentAngle = Math.atan2(
    event.clientY - centerY,
    event.clientX - centerX
  )
  
  const angleDelta = (currentAngle - startAngle) * (180 / Math.PI)
  
  let newAngle = (startRotateAngle + angleDelta) % 360
  if (newAngle < 0) newAngle += 360
  
  emit('update:element', {
    ...props.element,
    rotate: Math.round(newAngle)
  })
}

function stopRotate() {
  isRotating.value = false
  document.removeEventListener('mousemove', handleRotate)
  document.removeEventListener('mouseup', stopRotate)
}

// 监听编辑状态变化
watch(isEditing, (newVal) => {
  if (newVal) {
    // 进入编辑模式时，确保停止所有拖拽操作
    stopDrag()
  }
})

// 添加全局点击监听防止编辑模式意外关闭
function handleDocumentClick(event) {
  // 编辑模式下，只有点击在富文本编辑器外部才退出编辑
  if (isEditing.value && !event.target.closest('.rich-text-box')) {
    finishEditing(true)
  }
}

// 在组件挂载时添加事件监听
onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

// 在组件卸载时移除事件监听
onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
  // 清理所有事件监听器
  stopDrag()
  stopResize()
  stopRotate()
})
</script>

<style scoped>
.canvas-element {
  position: absolute;
  user-select: none;
  transform-origin: center;
}

.canvas-element.selected:not(.editing) {
  outline: 2px solid #409eff;
  cursor: move;
}
.canvas-element.editing {
  outline: 2px solid #67c23a;
  cursor: default;
}

/* 文本元素 */
.text-element {
  min-width: 100px;
  min-height: 30px;
  position: relative;
  cursor: text;
  overflow: hidden; /* 确保容器也隐藏溢出 */
}

.text-element:not(.editing) {
  cursor: move;
}

.text-edit-container {
  position: relative;
  min-width: 100px;
  min-height: 30px;
  cursor: default;
}

.text-display-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  text-align: left;
}

.text-display {
  width: 100%;
  height: 100%;
  overflow: hidden; /* 隐藏溢出文本 */
  word-wrap: break-word; /* 允许单词断行 */
}
.text-element:not(.editing) .text-display {
  cursor: move;
}

.text-element.editing .text-display {
  cursor: default;
}

/* 形状元素 */
.shape-element {
  width: 100%;
  height: 100%;
  cursor: move;
}

.shape-element.triangle {
  clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
}

.shape-element.circle {
  border-radius: 50%;
}

/* 图片元素 */
.image-element {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: move;
}

.image-element img {
  max-width: 100%;
  max-height: 100%;
  cursor: move;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f0f0;
  border: 1px dashed #ccc;
  color: #666;
  cursor: move;
}

/* 选中状态控件 */
.selection-controls {
  position: absolute;
  top: -8px;
  left: -8px;
  right: -8px;
  bottom: -8px;
  pointer-events: none;
}

.resize-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  background: #409eff;
  border: 2px solid white;
  border-radius: 2px;
  pointer-events: all;
}

.resize-handle.nw {
  top: -6px;
  left: -6px;
  cursor: nw-resize;
}

.resize-handle.ne {
  top: -6px;
  right: -6px;
  cursor: ne-resize;
}

.resize-handle.sw {
  bottom: -6px;
  left: -6px;
  cursor: sw-resize;
}

.resize-handle.se {
  bottom: -6px;
  right: -6px;
  cursor: se-resize;
}

.rotate-handle {
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 20px;
  background: #409eff;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  cursor: grab;
  pointer-events: all;
  user-select: none;
}

.rotate-handle:active {
  cursor: grabbing;
}
</style>