<template>
  <div class="infinite-canvas" ref="canvasContainer">
    <!-- MiniMap -->
    <div v-if="showMinimap" class="minimap">
      <div class="minimap-viewport" :style="viewportStyle"></div>
    </div>
    
    <!-- 画布滚动容器 -->
    <div 
      class="canvas-scroll-container" 
      ref="scrollContainer"
      @scroll="handleScroll"
      @wheel="handleWheel"
    >
      <!-- 无限画布 -->
      <div 
        class="infinite-stage" 
        ref="stage"
        :style="stageStyle"
        @mousedown="handleStageMouseDown"
        @mousemove="handleStageMouseMove"
        @mouseup="handleStageMouseUp"
        @mouseleave="handleStageMouseUp"
      >
        <!-- 选择框 -->
        <div 
          v-if="selectionBox.show" 
          class="selection-box"
          :style="selectionBoxStyle"
        ></div>
        
        <!-- 渲染所有元素 - 添加数据验证 -->
        <CanvasElement
          v-for="element in validElements"
          :key="element.id"
          :element="element"
          :isSelected="isElementSelected(element)"
          @mousedown="handleElementMouseDown($event, element)"
          @update:element="updateElement(element.id, $event)"
          @resize="handleElementResize"
          @textSelect="handleTextSelect"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import CanvasElement from './CanvasElement.vue'

const props = defineProps({
  elements: {
    type: Array,
    default: () => []
  },
  currentTool: {
    type: String,
    default: ''
  }
})
const emit = defineEmits(['select', 'update:elements', 'textSelect'])

/* ---------- 引用 ---------- */
const canvasContainer = ref(null)
const scrollContainer = ref(null)
const stage = ref(null)

/* ---------- 状态 ---------- */
const viewport = ref({ x: 0, y: 0, width: 0, height: 0 })
const scale = ref(1)
const stageSize = ref({ width: 5000, height: 5000 })
const isDragging = ref(false)
const isSelecting = ref(false)
const selectionStart = ref({ x: 0, y: 0 })
const selectionBox = ref({ show: false, x: 0, y: 0, width: 0, height: 0 })
const selectedElementIds = ref(new Set())
const isScrolling = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const draggedElements = ref([])
const elementStartPositions = ref([])
const lastMousePos = ref({ x: 0, y: 0 })

/* ---------- 计算属性 ---------- */
// 添加数据验证，确保所有元素都是有效的
const validElements = computed(() => {
  return props.elements.filter(element => 
    element && 
    typeof element === 'object' && 
    element.id && 
    element.type
  )
})

const stageStyle = computed(() => ({
  width: `${stageSize.value.width}px`,
  height: `${stageSize.value.height}px`,
  transform: `scale(${scale.value})`,
  transformOrigin: '0 0'
}))

const visibleElements = computed(() => {
  const paddedViewport = {
    x: viewport.value.x - 500,
    y: viewport.value.y - 500,
    width: viewport.value.width + 1000,
    height: viewport.value.height + 1000
  }
  
  return validElements.value.filter(element => 
    isElementInViewport(element, paddedViewport)
  )
})

const selectionBoxStyle = computed(() => ({
  left: `${selectionBox.value.x}px`,
  top: `${selectionBox.value.y}px`,
  width: `${selectionBox.value.width}px`,
  height: `${selectionBox.value.height}px`
}))

const viewportStyle = computed(() => ({
  left: `${(viewport.value.x / stageSize.value.width) * 100}%`,
  top: `${(viewport.value.y / stageSize.value.height) * 100}%`,
  width: `${(viewport.value.width / stageSize.value.width) * 100}%`,
  height: `${(viewport.value.height / stageSize.value.height) * 100}%`
}))

const showMinimap = computed(() => stageSize.value.width > 2000 || stageSize.value.height > 2000)

/* ---------- 方法 ---------- */
function isElementInViewport(element, viewport) {
  if (!element || typeof element.x !== 'number' || typeof element.y !== 'number') {
    return false
  }
  
  const elementWidth = element.width || 100
  const elementHeight = element.height || 100
  
  return (
    element.x < viewport.x + viewport.width &&
    element.x + elementWidth > viewport.x &&
    element.y < viewport.y + viewport.height &&
    element.y + elementHeight > viewport.y
  )
}

function isElementSelected(element) {
  return element && element.id && selectedElementIds.value.has(element.id)
}

function handleElementMouseDown(event, element) {
  if (!element) return
  
  event.stopPropagation()
  
  const rect = stage.value.getBoundingClientRect()
  const stageX = (event.clientX - rect.left) / scale.value
  const stageY = (event.clientY - rect.top) / scale.value
  if (element.type === 'text' && element.isEditing) {
    return
  }
  if (event.ctrlKey || event.metaKey) {
    // 多选
    if (selectedElementIds.value.has(element.id)) {
      selectedElementIds.value.delete(element.id)
    } else {
      selectedElementIds.value.add(element.id)
    }
  } else {
    // 检查是否点击在已选元素上
    const clickedOnSelected = Array.from(selectedElementIds.value).some(id => {
      const el = props.elements.find(e => e && e.id === id)
      return el && isPointInElement(stageX, stageY, el)
    })
    
    if (!clickedOnSelected) {
      // 如果没有点击在已选元素上，重新选择
      selectedElementIds.value = new Set([element.id])
    }
  }
  
  emitSelection()
  
  // 开始拖拽
  isDragging.value = true
  dragStart.value = {
    x: event.clientX,
    y: event.clientY
  }
  
  lastMousePos.value = {
    x: event.clientX,
    y: event.clientY
  }
  
  draggedElements.value = validElements.value.filter(el => 
    selectedElementIds.value.has(el.id)
  )
  
  elementStartPositions.value = draggedElements.value.map(el => ({
    id: el.id,
    x: el.x,
    y: el.y
  }))
  
  document.addEventListener('mousemove', handleElementDrag)
  document.addEventListener('mouseup', stopElementDrag)
}

function isPointInElement(x, y, element) {
  if (!element) return false
  
  const elementWidth = element.width || 100
  const elementHeight = element.height || 100
  
  return (
    x >= element.x &&
    x <= element.x + elementWidth &&
    y >= element.y &&
    y <= element.y + elementHeight
  )
}

function handleElementDrag(event) {
  if (!isDragging.value) return
  
  const deltaX = (event.clientX - dragStart.value.x) / scale.value
  const deltaY = (event.clientY - dragStart.value.y) / scale.value
  
  const newElements = [...props.elements]
  
  draggedElements.value.forEach((element, index) => {
    if (!element) return
    
    const startPos = elementStartPositions.value[index]
    const elementIndex = newElements.findIndex(el => el && el.id === element.id)
    
    if (elementIndex !== -1) {
      newElements[elementIndex] = {
        ...newElements[elementIndex],
        x: Math.round(startPos.x + deltaX),
        y: Math.round(startPos.y + deltaY)
      }
    }
  })
  
  emit('update:elements', newElements)
  
  // 平滑滚动当拖拽到边缘时
  handleEdgeScrolling(event)
  
  lastMousePos.value = {
    x: event.clientX,
    y: event.clientY
  }
}

function handleEdgeScrolling(event) {
  if (!scrollContainer.value) return
  
  const containerRect = scrollContainer.value.getBoundingClientRect()
  const edgeThreshold = 50
  const scrollSpeed = 10
  
  let scrollX = 0
  let scrollY = 0
  
  // 检查是否靠近边缘
  if (event.clientX < containerRect.left + edgeThreshold) {
    scrollX = -scrollSpeed
  } else if (event.clientX > containerRect.right - edgeThreshold) {
    scrollX = scrollSpeed
  }
  
  if (event.clientY < containerRect.top + edgeThreshold) {
    scrollY = -scrollSpeed
  } else if (event.clientY > containerRect.right - edgeThreshold) {
    scrollY = scrollSpeed
  }
  
  // 执行滚动
  if (scrollX !== 0 || scrollY !== 0) {
    scrollContainer.value.scrollLeft += scrollX
    scrollContainer.value.scrollTop += scrollY
  }
}

function stopElementDrag() {
  isDragging.value = false
  draggedElements.value = []
  elementStartPositions.value = []
  
  document.removeEventListener('mousemove', handleElementDrag)
  document.removeEventListener('mouseup', stopElementDrag)
}

function handleStageMouseDown(event) {
  if (event.target === stage.value) {
    // 如果有当前工具且是文本工具，在点击位置创建文本
    if (props.currentTool === 'text') {
      const rect = stage.value.getBoundingClientRect()
      const x = (event.clientX - rect.left) / scale.value
      const y = (event.clientY - rect.top) / scale.value
      
      emit('addElement', {
        type: 'text',
        x: Math.round(x),
        y: Math.round(y),
        text: '双击编辑文本'
      })
      return
    }
    
    // 原有的选择逻辑
    selectedElementIds.value = new Set()
    emitSelection()
    
    isSelecting.value = true
    const rect = stage.value.getBoundingClientRect()
    selectionStart.value = {
      x: (event.clientX - rect.left) / scale.value,
      y: (event.clientY - rect.top) / scale.value
    }
    
    selectionBox.value = {
      show: true,
      x: selectionStart.value.x,
      y: selectionStart.value.y,
      width: 0,
      height: 0
    }
  }
}

function handleStageMouseMove(event) {
  if (!isSelecting.value) return
  
  const rect = stage.value.getBoundingClientRect()
  const currentX = (event.clientX - rect.left) / scale.value
  const currentY = (event.clientY - rect.top) / scale.value
  
  selectionBox.value = {
    show: true,
    x: Math.min(selectionStart.value.x, currentX),
    y: Math.min(selectionStart.value.y, currentY),
    width: Math.abs(currentX - selectionStart.value.x),
    height: Math.abs(currentY - selectionStart.value.y)
  }
  
  // 框选元素
  if (selectionBox.value.width > 5 && selectionBox.value.height > 5) {
    const selected = validElements.value.filter(element => 
      isElementInSelection(element, selectionBox.value)
    )
    selectedElementIds.value = new Set(selected.map(el => el.id))
    emitSelection()
  }
}

function handleStageMouseUp() {
  isSelecting.value = false
  selectionBox.value.show = false
}

function isElementInSelection(element, selection) {
  if (!element) return false
  
  const elementWidth = element.width || 100
  const elementHeight = element.height || 100
  
  return (
    element.x < selection.x + selection.width &&
    element.x + elementWidth > selection.x &&
    element.y < selection.y + selection.height &&
    element.y + elementHeight > selection.y
  )
}

function emitSelection() {
  const selectedElements = validElements.value.filter(el => 
    selectedElementIds.value.has(el.id)
  )
  emit('select', selectedElements)
}

function updateElement(id, updates) {
  const index = props.elements.findIndex(el => el && el.id === id)
  if (index !== -1) {
    const newElements = [...props.elements]
    
    // 如果标记为删除，则移除元素
    if (updates.deleted) {
      newElements.splice(index, 1)
    } else {
      newElements[index] = { ...newElements[index], ...updates }
    }
    
    emit('update:elements', newElements)
  }
}

function handleElementResize() {
  // 元素大小改变时触发更新
  emit('update:elements', [...props.elements])
}

function handleTextSelect(data) {
  // 处理文本选择事件
  emit('textSelect', data)
}

function handleScroll() {
  if (scrollContainer.value && !isScrolling.value) {
    viewport.value.x = scrollContainer.value.scrollLeft
    viewport.value.y = scrollContainer.value.scrollTop
  }
}

function handleWheel(event) {
  if (event.ctrlKey) {
    event.preventDefault()
    const delta = -event.deltaY / 1000
    const newScale = Math.min(Math.max(0.1, scale.value + delta), 3)
    scale.value = newScale
    updateViewport()
  }
}

function updateViewport() {
  if (scrollContainer.value) {
    viewport.value = {
      x: scrollContainer.value.scrollLeft,
      y: scrollContainer.value.scrollTop,
      width: scrollContainer.value.clientWidth / scale.value,
      height: scrollContainer.value.clientHeight / scale.value
    }
  }
}

function exportAsImage(filename) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  
  validElements.value.forEach(element => {
    minX = Math.min(minX, element.x)
    minY = Math.min(minY, element.y)
    maxX = Math.max(maxX, element.x + (element.width || 100))
    maxY = Math.max(maxY, element.y + (element.height || 100))
  })
  
  const padding = 50
  const width = Math.max(maxX - minX + padding * 2, 100)
  const height = Math.max(maxY - minY + padding * 2, 100)
  
  canvas.width = width
  canvas.height = height
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  
  validElements.value.forEach(element => {
    renderElementToCanvas(ctx, element, minX - padding, minY - padding)
  })
  
  const link = document.createElement('a')
  link.download = `${filename || 'canvas'}.png`
  link.href = canvas.toDataURL()
  link.click()
}

function renderElementToCanvas(ctx, element, offsetX, offsetY) {
  if (!element) return
  
  ctx.save()
  
  const x = element.x - offsetX
  const y = element.y - offsetY
  
  switch (element.type) {
    case 'shape':
      renderShapeToCanvas(ctx, element, x, y)
      break
    case 'text':
      renderTextToCanvas(ctx, element, x, y)
      break
    case 'image':
      renderImageToCanvas(ctx, element, x, y)
      break
  }
  
  ctx.restore()
}

function renderShapeToCanvas(ctx, element, x, y) {
  const { shapeType, width = 100, height = 100, backgroundColor, borderWidth = 2, borderColor = '#3375d9' } = element
  
  if (backgroundColor) {
    ctx.fillStyle = backgroundColor
  }
  
  if (borderWidth && borderColor) {
    ctx.strokeStyle = borderColor
    ctx.lineWidth = borderWidth
  }
  
  switch (shapeType) {
    case 'rect':
      ctx.fillRect(x, y, width, height)
      if (borderWidth) ctx.strokeRect(x, y, width, height)
      break
    case 'circle':
      ctx.beginPath()
      ctx.arc(x + width/2, y + height/2, Math.min(width, height)/2, 0, Math.PI * 2)
      ctx.fill()
      if (borderWidth) ctx.stroke()
      break
    case 'triangle':
      ctx.beginPath()
      ctx.moveTo(x + width/2, y)
      ctx.lineTo(x + width, y + height)
      ctx.lineTo(x, y + height)
      ctx.closePath()
      ctx.fill()
      if (borderWidth) ctx.stroke()
      break
  }
}

function renderTextToCanvas(ctx, element, x, y) {
  const { text, fontSize = 16, fontFamily = 'Arial', color = '#000000', backgroundColor } = element
  
  ctx.font = `${fontSize}px ${fontFamily}`
  ctx.fillStyle = color
  
  if (backgroundColor) {
    const metrics = ctx.measureText(text)
    ctx.fillStyle = backgroundColor
    ctx.fillRect(x, y, metrics.width, fontSize)
    ctx.fillStyle = color
  }
  
  ctx.fillText(text, x, y + fontSize)
}

function renderImageToCanvas(ctx, element, x, y) {
  const { image, width = 200, height = 150 } = element
  
  if (image && image.url) {
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, x, y, width, height)
    }
    img.src = image.url
  }
}

/* ---------- 生命周期 ---------- */
onMounted(() => {
  updateViewport()
  window.addEventListener('resize', updateViewport)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateViewport)
})

// 暴露方法给父组件
defineExpose({
  exportAsImage
})
</script>

<style scoped>
.infinite-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.canvas-scroll-container {
  width: 100%;
  height: 100%;
  overflow: auto;
  position: relative;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.canvas-scroll-container::-webkit-scrollbar {
  display: none; /* Chrome, Safari and Opera */
}

.infinite-stage {
  position: relative;
  background: 
    linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
    linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
    linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}

.selection-box {
  position: absolute;
  border: 2px dashed #409eff;
  background: rgba(64, 158, 255, 0.1);
  pointer-events: none;
  z-index: 1000;
}

.minimap {
  position: absolute;
  bottom: 20px;
  right: 20px;
  width: 150px;
  height: 100px;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  overflow: hidden;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.minimap-viewport {
  position: absolute;
  border: 2px solid #409eff;
  background: rgba(64, 158, 255, 0.2);
  pointer-events: none;
}
</style>