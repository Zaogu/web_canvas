<template>
  <div id="app">
    <!-- 顶部栏 -->
    <header class="header">
      <div class="header-left">
        <input
          v-model="canvas_name"
          type="text"
          class="canvas-title"
          placeholder="请输入画布名称"
        />
      </div>
      <div class="header-right">
        <button class="save-btn" @click="saveCanvas">保存画布</button>
        <button class="clear-btn" @click="clearCanvas">清空画布</button>
        <button class="undo-btn" @click="undo" :disabled="historyIndex <= 0">撤销</button>
        <button class="redo-btn" @click="redo" :disabled="historyIndex >= history.length - 1">重做</button>
      </div>
    </header>

    <!--工具栏+画布区域 -->
    <section class="workplace">
      <aside class="sidebar">
        <!--工具栏按钮列表-->
        <nav class="sidebar-menu">
          <div v-for="t in tools" :key="t.key" class="tool-item">
            <button
              class="menu-item"
              :class="{ active: currentTool === t.key }"
              @click="selectTool(t.key)"
            >
              <span class="menu-icon" v-text="t.icon"></span>
              <span class="menu-text" v-text="t.text"></span>   
            </button>
          </div>
        </nav>
      </aside>

      <!-- 浮动工具面板 -->
      <div v-if="currentTool && showFloatingPanel" class="floating-panel" :style="panelStyle">
        <div class="panel-content">
          <!-- 文字工具 -->
          <div v-if="currentTool === 'text'" class="tool-section">
            <h4>文字工具</h4>
            <div class="text-controls">
              <select v-model="textFontFamily">
                <option value="Arial">Arial</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
                <option value="Verdana">Verdana</option>
              </select>
              <input type="number" v-model.number="textFontSize" min="8" max="72" placeholder="字号">
              <input type="color" v-model="textColor">
            </div>
            <button class="add-btn" @click="addTextElement">添加文本框</button>
            <p class="hint">提示：在画布上点击添加文本框，或双击现有文本框进行编辑</p>
          </div>

          <!-- 形状工具 -->
          <div v-if="currentTool === 'shape'" class="tool-section">
            <h4>形状工具</h4>
            <div class="shape-buttons">
              <button class="shape-btn" @click="addShape('triangle')">
                <div class="shape-preview triangle"></div>
                <span>三角形</span>
              </button>
              <button class="shape-btn" @click="addShape('rect')">
                <div class="shape-preview rect"></div>
                <span>矩形</span>
              </button>
              <button class="shape-btn" @click="addShape('circle')">
                <div class="shape-preview circle"></div>
                <span>圆形</span>
              </button>
            </div>
          </div>

          <!-- 图片工具 -->
          <div v-if="currentTool === 'image'" class="tool-section">
            <h4>图片工具</h4>
            <div class="upload-area" @click="triggerFileInput">
              <span class="upload-icon">📁</span>
              <p>点击上传图片</p>
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                @change="handleFileSelect"
                style="display: none"
              />
            </div>
          </div>
        </div>
      </div>
      
      <main class="canvas-container">
        <InfiniteCanvas
          ref="infiniteCanvas"
          :elements="canvasElements.filter(el => el && el.id && el.type)"
          :currentTool="currentTool"
          @select="handleElementSelect"
          @update:elements="handleElementsUpdate"
          @addElement="handleAddElement"
          @textSelect="handleTextSelect"
        />
        
        <!-- 浮动工具栏 -->
        <FloatingToolbar
          v-if="selectedElements.length > 0"
          :selectedElements="selectedElements"
          :selectedText="selectedText"
          @updateElement="updateSelectedElements"
          @deleteElements="deleteSelectedElements"
          @updateLocalTextStyle="updateLocalTextStyle"
        />
      </main>
    </section>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import FloatingToolbar from './components/FloatingToolbar.vue'
import InfiniteCanvas from './components/InfiniteCanvas.vue'

/* ---------- 顶部栏，保存文件名 ---------- */
const canvas_name = ref('我的画布')

/* ---------- 工具切换 ---------- */
const currentTool = ref('') // 默认不选择工具
const showFloatingPanel = ref(false)
const tools = [
  { key: 'text',   icon: '📝', text: '文字' },
  { key: 'shape',  icon: '⬛', text: '形状' },
  { key: 'image',  icon: '🖼️', text: '图片' }
]

// 文本编辑器配置
const textFontFamily = ref('Arial')
const textFontSize = ref(16)
const textColor = ref('#000000')

// 浮动面板位置
const panelStyle = ref({})

function selectTool(key) {
  if (currentTool.value === key) {
    // 点击相同工具时关闭面板
    currentTool.value = ''
    showFloatingPanel.value = false
  } else {
    currentTool.value = key
    showFloatingPanel.value = true
    updatePanelPosition()
  }
}

function updatePanelPosition() {
  nextTick(() => {
    const buttons = document.querySelectorAll('.menu-item')
    const activeButton = Array.from(buttons).find(btn => 
      btn.querySelector('.menu-text').textContent === tools.find(t => t.key === currentTool.value)?.text
    )
    
    if (activeButton) {
      const rect = activeButton.getBoundingClientRect()
      panelStyle.value = {
        top: `${rect.top}px`,
        left: `${rect.right + 10}px`
      }
    }
  })
}

/* ---------- 文字工具 ---------- */
function addTextElement() {
  const newElement = {
    id: Date.now().toString(),
    type: 'text',
    x: 100,
    y: 100,
    text: '<p>双击编辑文本</p>',
    fontSize: textFontSize.value,
    fontFamily: textFontFamily.value,
    color: textColor.value,
    backgroundColor: '#ffffff', // 改为白色而不是 transparent
    width: 200,
    height: 40,
    rotate: 0
  }
  
  canvasElements.value.push(newElement)
  selectedElements.value = [newElement]
  saveHistory()
  
  showFloatingPanel.value = false
  currentTool.value = ''
}

function handleAddElement(element) {
  if (element.type === 'text') {
    // 直接创建文本元素
    const newElement = {
      id: Date.now().toString(),
      type: 'text',
      x: element.x,
      y: element.y,
      text: '<p>双击编辑文本</p>',
      fontSize: textFontSize.value,
      fontFamily: textFontFamily.value,
      color: textColor.value,
      backgroundColor: 'transparent',
      width: 200,
      height: 40
    }
    
    canvasElements.value.push(newElement)
    selectedElements.value = [newElement]
    saveHistory()
  } else {
    canvasElements.value.push(element)
    selectedElements.value = [element]
    saveHistory()
  }
}

/* ---------- 形状工具 ---------- */
function addShape(shapeType) {
  const newElement = {
    id: Date.now().toString(),
    type: 'shape',
    shapeType: shapeType,
    x: 200,
    y: 200,
    width: 100,
    height: 100,
    backgroundColor: '#409eff',
    borderWidth: 2,
    borderColor: '#3375d9'
  }
  canvasElements.value.push(newElement)
  selectedElements.value = [newElement]
  saveHistory()
}

/* ---------- 图片工具 ---------- */
const fileInput = ref(null)

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileSelect(event) {
  const file = event.target.files[0]
  if (file && file.type.startsWith('image/')) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const newElement = {
        id: Date.now().toString(),
        type: 'image',
        x: 150,
        y: 150,
        width: 200,
        height: 150,
        image: {
          url: e.target.result,
          name: file.name,
          type: file.type
        },
        filter: 'none',
        opacity: 1
      }
      canvasElements.value.push(newElement)
      selectedElements.value = [newElement]
      saveHistory()
    }
    reader.readAsDataURL(file)
  }
}

/* ---------- 画布元素管理 ---------- */
const canvasElements = ref([])
const selectedElements = ref([])
const selectedText = ref(null)
const infiniteCanvas = ref(null)

// 历史记录
const history = ref([])
const historyIndex = ref(-1)

// 从本地存储加载数据
function loadFromStorage() {
  const saved = localStorage.getItem('infinite-canvas-data')
  if (saved) {
    try {
      const data = JSON.parse(saved)
      
      // 数据验证和清理
      canvasElements.value = (data.elements || []).filter(element => 
        element && 
        typeof element === 'object' && 
        element.id && 
        element.type
      )
      
      history.value = data.history || [JSON.parse(JSON.stringify(canvasElements.value))]
      historyIndex.value = data.historyIndex || 0
      
      // 加载复制的元素
      if (data.copiedElements) {
        copiedElements = data.copiedElements
      }
    } catch (e) {
      console.error('加载数据失败:', e)
      // 初始化空数据
      canvasElements.value = []
      saveHistory()
    }
  } else {
    saveHistory()
  }
}

// 保存到本地存储
function saveToStorage() {
  try {
    localStorage.setItem('infinite-canvas-data', JSON.stringify({
      elements: canvasElements.value,
      history: history.value,
      historyIndex: historyIndex.value,
      copiedElements: copiedElements
    }))
  } catch (e) {
    console.error('保存数据失败:', e)
  }
}

// 保存历史记录
function saveHistory() {
  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1)
  }
  
  history.value.push(JSON.parse(JSON.stringify(canvasElements.value)))
  historyIndex.value = history.value.length - 1
  
  if (history.value.length > 50) {
    history.value.shift()
    historyIndex.value = history.value.length - 1
  }
  
  saveToStorage()
}

// 撤销
function undo() {
  if (historyIndex.value > 0) {
    historyIndex.value--
    canvasElements.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]))
    selectedElements.value = []
    saveToStorage()
  }
}

// 重做
function redo() {
  if (historyIndex.value < history.value.length - 1) {
    historyIndex.value++
    canvasElements.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]))
    selectedElements.value = []
    saveToStorage()
  }
}

// 自动保存监听
watch(canvasElements, () => {
  saveToStorage()
}, { deep: true })

/* ---------- 元素选择 ---------- */
function handleElementSelect(elements) {
  selectedElements.value = elements
  selectedText.value = null
}

/* ---------- 文本选择处理 ---------- */
function handleTextSelect(data) {
  selectedText.value = data
}

/* ---------- 局部文本样式更新 ---------- */
function updateLocalTextStyle(style) {
  // 这里可以实现局部文本样式更新
  console.log('更新局部文本样式:', style)
}

/* ---------- 元素更新 ---------- */
function handleElementsUpdate(elements) {
  canvasElements.value = elements
  saveHistory()
}

/* ---------- 更新选中元素 ---------- */
function updateSelectedElements(updates) {
  selectedElements.value.forEach(element => {
    Object.assign(element, updates)
  })
  canvasElements.value = [...canvasElements.value]
  saveHistory()
}

/* ---------- 删除选中元素 ---------- */
function deleteSelectedElements() {
  const selectedIds = new Set(selectedElements.value.map(el => el.id))
  canvasElements.value = canvasElements.value.filter(el => !selectedIds.has(el.id))
  selectedElements.value = []
  saveHistory()
}

/* ---------- 保存画布 ---------- */
function saveCanvas() {
  if (infiniteCanvas.value) {
    infiniteCanvas.value.exportAsImage(canvas_name.value)
  }
}

/* ---------- 清空画布 ---------- */
function clearCanvas() {
  if (confirm('确定要清空画布吗？')) {
    canvasElements.value = []
    selectedElements.value = []
    saveHistory()
  }
}

/* ---------- 快捷键 ---------- */
let copiedElements = []

function onKeydown(e) {
  // 如果正在编辑文本，不处理删除快捷键
  const isEditingText = document.querySelector('.canvas-element.editing')
  if (isEditingText) {
    return
  }
  
  // 删除键
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElements.value.length > 0) {
    e.preventDefault()
    deleteSelectedElements()
  }
  
  // 复制粘贴
  if (e.ctrlKey && e.key === 'c' && selectedElements.value.length > 0) {
    e.preventDefault()
    copySelectedElements()
  }
  
  if (e.ctrlKey && e.key === 'v' && copiedElements.length > 0) {
    e.preventDefault()
    pasteElements()
  }
  
  // 撤销重做
  if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    undo()
  }
  
  if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
    e.preventDefault()
    redo()
  }
  
  // 全选
  if (e.ctrlKey && e.key === 'a') {
    e.preventDefault()
    selectedElements.value = [...canvasElements.value]
  }
}

function copySelectedElements() {
  copiedElements = JSON.parse(JSON.stringify(selectedElements.value))
  saveToStorage() // 保存复制的元素
}

function pasteElements() {
  if (copiedElements.length === 0) return
  
  const newElements = copiedElements.map(el => ({
    ...el,
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    x: el.x + 20,
    y: el.y + 20
  }))
  
  canvasElements.value.push(...newElements)
  selectedElements.value = newElements
  saveHistory()
}

/* ---------- 初始化 ---------- */
onMounted(() => {
  loadFromStorage()
  // 点击页面其他区域关闭浮动面板
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', onKeydown)
})

function handleDocumentClick(event) {
  const panel = document.querySelector('.floating-panel')
  const sidebar = document.querySelector('.sidebar')
  
  if (panel && !panel.contains(event.target) && 
      sidebar && !sidebar.contains(event.target)) {
    showFloatingPanel.value = false
    currentTool.value = ''
  }
}

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<style scoped>
/* ---------- 全局重置 ---------- */
* { box-sizing: border-box; margin: 0; padding: 0; }
#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: 'Segoe UI', Roboto, sans-serif;
  background: #f2f6ff;
  overflow: hidden;
}

/* ---------- 顶部栏 ---------- */
.header {
  flex: 0 0 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  background: rgba(109, 171, 215, 0.75);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.header-left {
  flex: 1;             
  display: flex;
  align-items: center;
  gap: 12px;            
}

.canvas-title {
  width: 100%;          
  max-width: 1000px;     
  min-width: 220px;     
  height: 36px;
  padding: 0 12px;
  border: 1px solid #d0dcee;
  border-radius: 6px;
  font-size: 15px;
  color: #303133;
  background: #fff;
  transition: border-color .2s, box-shadow .2s;
}

.canvas-title:focus {
  outline: none;
  border-color: #409eff;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.15);
}

.save-btn, .clear-btn, .undo-btn, .redo-btn {
  height: 36px;
  padding: 0 20px;
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  background: linear-gradient(135deg, #409eff 0%, #3375d9 100%);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  margin-left: 10px;
}

.clear-btn {
  background: linear-gradient(135deg, #f56c6c 0%, #d93a3a 100%);
}

.undo-btn, .redo-btn {
  background: linear-gradient(135deg, #67c23a 0%, #5daf34 100%);
}

.undo-btn:disabled, .redo-btn:disabled {
  background: #c0c4cc;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.save-btn:hover:not(:disabled), 
.clear-btn:hover:not(:disabled), 
.undo-btn:hover:not(:disabled), 
.redo-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.35);
}

.save-btn:active:not(:disabled), 
.clear-btn:active:not(:disabled), 
.undo-btn:active:not(:disabled), 
.redo-btn:active:not(:disabled) {
  transform: translateY(0);
}

/* ---------- 工作区布局 ---------- */
.workplace {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

/* ---------- 侧边栏样式 ---------- */
.sidebar {
  width: 80px;
  background: rgba(10, 51, 238, 0.1);
  backdrop-filter: blur(10px);
  color: #333;
  border-right: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
  z-index: 100;
}

.sidebar-menu {
  display: flex;
  flex-direction: column;
  padding: 10px 0;
}

.menu-item {
  padding: 15px 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: none;
  width: 100%;
  color: #2c3e50;
  font-weight: 500;
  position: relative;
}

.menu-item:hover {
  background: rgba(255, 255, 255, 0.2);
}

.menu-item.active {
  background: rgba(255, 255, 255, 0.3);
}

.menu-icon {
  font-size: 24px;
}

.menu-text {
  font-size: 12px;
}

/* ---------- 浮动面板 ---------- */
.floating-panel {
  position: fixed;
  background: white;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 250px;
  max-width: 300px;
}

.panel-content {
  padding: 16px;
}

.tool-section h4 {
  margin: 0 0 12px 0;
  color: #2c3e50;
  font-size: 14px;
}

.tool-section textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  resize: vertical;
  min-height: 60px;
  margin-bottom: 10px;
  font-family: inherit;
}

.text-controls {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.text-controls select,
.text-controls input[type="number"] {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}

.text-controls input[type="color"] {
  width: 40px;
  height: 32px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 0;
}

.add-btn {
  width: 100%;
  padding: 8px 16px;
  background: #409eff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.add-btn:hover {
  background: #3375d9;
}

.shape-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shape-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
}

.shape-btn:hover {
  border-color: #409eff;
  background-color: rgba(64, 158, 255, 0.05);
}

.shape-preview {
  width: 24px;
  height: 24px;
  border: 2px solid #333;
  background: #f8f9fa;
}

.shape-preview.triangle {
  clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
  background: #333;
  border: none;
}

.shape-preview.rect {
  background: #333;
}

.shape-preview.circle {
  border-radius: 50%;
  background: #333;
}

.upload-area {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.upload-area:hover {
  border-color: #409eff;
  background-color: rgba(64, 158, 255, 0.05);
}

.upload-icon {
  font-size: 24px;
  display: block;
  margin-bottom: 8px;
}

.upload-area p {
  margin: 0;
  font-weight: 500;
  color: #666;
}

/* ---------- 画布区域 ---------- */
.canvas-container {
  flex: 1;
  padding: 24px;
  overflow: hidden;
  position: relative;
  background: #f0f2f5;
}
.hint {
  font-size: 12px;
  color: #666;
  margin-top: 10px;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 4px;
}
</style>