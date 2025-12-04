<template>
  <div class="floating-toolbar" :style="toolbarStyle">
    <!-- 局部文本样式工具栏 -->
    <div v-if="hasTextSelection" class="toolbar-section">
      <label>局部样式:</label>
      <button 
        class="toolbar-btn" 
        :class="{ active: localTextConfig.bold }"
        @click="toggleLocalTextStyle('bold')"
        title="加粗"
      >B</button>
      
      <button 
        class="toolbar-btn" 
        :class="{ active: localTextConfig.italic }"
        @click="toggleLocalTextStyle('italic')"
        title="斜体"
      >I</button>
      
      <button 
        class="toolbar-btn" 
        :class="{ active: localTextConfig.underline }"
        @click="toggleLocalTextStyle('underline')"
        title="下划线"
      >U</button>
      
      <button 
    class="toolbar-btn" 
    :class="{ active: localTextConfig.strike }"
    @click="toggleLocalTextStyle('strike')"
    title="删除线"
  >S</button>

      <input 
        type="color" 
        v-model="localTextConfig.color" 
        @change="updateLocalTextStyle"
        title="文字颜色"
      >
      
      <input 
        type="color" 
        v-model="localTextConfig.backgroundColor" 
        @change="updateLocalTextStyle"
        title="文字背景色"
      >
    </div>
    
    <!-- 全局文本工具栏 -->
    <div v-if="hasText && !hasTextSelection" class="toolbar-section">
      <label>字体:</label>
      <select v-model="textConfig.fontFamily" @change="updateText">
        <option value="Arial">Arial</option>
        <option value="Helvetica">Helvetica</option>
        <option value="Times New Roman">Times New Roman</option>
        <option value="Courier New">Courier New</option>
        <option value="Verdana">Verdana</option>
      </select>
      
      <label>字号:</label>
      <input 
        type="number" 
        v-model.number="textConfig.fontSize" 
        @input="updateText"
        min="8"
        max="72"
      >
      
      <button 
        class="toolbar-btn" 
        :class="{ active: textConfig.bold }"
        @click="toggleTextStyle('bold')"
        title="加粗"
      >B</button>
      
      <button 
        class="toolbar-btn" 
        :class="{ active: textConfig.italic }"
        @click="toggleTextStyle('italic')"
        title="斜体"
      >I</button>
      
      <button 
        class="toolbar-btn" 
        :class="{ active: textConfig.underline }"
        @click="toggleTextStyle('underline')"
        title="下划线"
      >U</button>
      
      <input 
        type="color" 
        v-model="textConfig.color" 
        @change="updateText"
        title="文字颜色"
      >
      
      <input 
        type="color" 
        v-model="textConfig.backgroundColor" 
        @change="updateText"
        title="文本框背景色"
      >
    </div>
    
    <!-- 形状工具栏 -->
    <div v-if="hasShape" class="toolbar-section">
      <label>背景色:</label>
      <input 
        type="color" 
        v-model="shapeConfig.backgroundColor" 
        @change="updateShape"
      >
      
      <label>边框:</label>
      <input 
        type="number" 
        v-model.number="shapeConfig.borderWidth" 
        @input="updateShape"
        min="0"
        max="10"
      >
      
      <input 
        type="color" 
        v-model="shapeConfig.borderColor" 
        @change="updateShape"
      >
    </div>
    
    <!-- 图片工具栏 -->
    <div v-if="hasImage" class="toolbar-section">
      <label>滤镜:</label>
      <select v-model="imageConfig.filter" @change="updateImage">
        <option value="none">无滤镜</option>
        <option value="grayscale">灰度</option>
        <option value="sepia">怀旧</option>
        <option value="blur">模糊</option>
        <option value="brightness">亮度</option>
      </select>
      
      <label>透明度:</label>
      <input 
        type="range" 
        v-model.number="imageConfig.opacity" 
        @input="updateImage"
        min="0"
        max="1"
        step="0.1"
      >
      <span>{{ imageConfig.opacity }}</span>
    </div>
    
    <!-- 通用工具栏 -->
    <div class="toolbar-section">
      <button class="toolbar-btn danger" @click="$emit('deleteElements')" title="删除">
        🗑️
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  selectedElements: {
    type: Array,
    default: () => []
  },
  selectedText: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['updateElement', 'deleteElements', 'updateLocalTextStyle'])

/* ---------- 计算属性 ---------- */
const hasText = computed(() => 
  props.selectedElements.some(el => el && el.type === 'text')
)

const hasTextSelection = computed(() => 
  props.selectedText && props.selectedText.selectedText && props.selectedText.selectedText.length > 0
)

const hasShape = computed(() => 
  props.selectedElements.some(el => el && el.type === 'shape')
)

const hasImage = computed(() => 
  props.selectedElements.some(el => el && el.type === 'image')
)

const toolbarStyle = computed(() => {
  if (props.selectedElements.length === 0 && !props.selectedText) return {}
  
  // 处理文本选择时的工具栏位置
  if (props.selectedText && props.selectedText.selection) {
    try {
      const range = props.selectedText.selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      
      // 添加边界检查，确保工具栏在视窗内
      const toolbarTop = Math.max(10, rect.top - 40)
      const toolbarLeft = Math.max(10, rect.left)
      
      return {
        left: `${toolbarLeft}px`,
        top: `${toolbarTop}px`,
        position: 'fixed' // 确保使用固定定位
      }
    } catch (e) {
      console.warn('无法获取文本选择位置:', e)
    }
  }
  
  // 处理元素选择时的工具栏位置
  if (props.selectedElements.length > 0) {
    let minX = Infinity, minY = Infinity
    
    props.selectedElements.forEach(element => {
      if (!element) return
      minX = Math.min(minX, element.x)
      minY = Math.min(minY, element.y)
    })
    
    if (minX !== Infinity && minY !== Infinity) {
      return {
        left: `${minX}px`,
        top: `${minY - 50}px`,
        position: 'absolute' // 元素选择时使用绝对定位
      }
    }
  }
  
  return {}
})
/* ---------- 配置状态 ---------- */
const textConfig = ref({})
const shapeConfig = ref({})
const imageConfig = ref({})
const localTextConfig = ref({
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  color: '#000000',
  backgroundColor: '#ffffff' // 改为白色而不是 transparent
})

/* ---------- 方法 ---------- */

const filterMap = {
  none: 'none',
  grayscale: 'grayscale(100%)',
  sepia: 'sepia(100%)',
  blur: 'blur(5px)',
  brightness: 'brightness(1.2)'
}

function updateTextConfig() {
  const textElement = props.selectedElements.find(el => el && el.type === 'text')
  if (textElement) {
    textConfig.value = { ...textElement }
  } else {
    textConfig.value = {}
  }
}

function updateShapeConfig() {
  const shapeElement = props.selectedElements.find(el => el && el.type === 'shape')
  if (shapeElement) {
    shapeConfig.value = { ...shapeElement }
  } else {
    shapeConfig.value = {}
  }
}

function updateImageConfig() {
  const imageElement = props.selectedElements.find(el => el && el.type === 'image')
  if (imageElement) {
    imageConfig.value = { ...imageElement }
  } else {
    imageConfig.value = {}
  }
}

function updateLocalTextConfig() {
  if (props.selectedText) {
    // 这里可以分析选中文本的当前样式
    // 简化实现：重置为默认值
    localTextConfig.value = {
      bold: false,
      italic: false,
      underline: false,
      color: '#000000',
      backgroundColor: '#ffffff'
    }
  } else {
    localTextConfig.value = {
      bold: false,
      italic: false,
      underline: false,
      color: '#000000',
      backgroundColor: '#ffffff'
    }
  }
}

function updateLocalTextStyle(style) {
  if (props.selectedText && props.selectedText.editor) {
    const editor = props.selectedText.editor
    
    // 应用文本样式
    if (style.bold !== undefined) {
      if (style.bold) {
        editor.chain().focus().toggleBold().run()
      } else {
        editor.chain().focus().toggleBold().run()
      }
    }
    if (style.italic !== undefined) {
      if (style.italic) {
        editor.chain().focus().toggleItalic().run()
      } else {
        editor.chain().focus().toggleItalic().run()
      }
    }
    if (style.underline !== undefined) {
      if (style.underline) {
        editor.chain().focus().toggleUnderline().run()
      } else {
        editor.chain().focus().toggleUnderline().run()
      }
    }
    if (style.color) {
      editor.chain().focus().setColor(style.color).run()
    }
  }
}

function toggleLocalTextStyle(style) {
  localTextConfig.value[style] = !localTextConfig.value[style]
  updateLocalTextStyle({ [style]: localTextConfig.value[style] })
}

function updateText() {
  if (Object.keys(textConfig.value).length > 0) {
    emit('updateElement', { ...textConfig.value })
  }
}

function updateShape() {
  if (Object.keys(shapeConfig.value).length > 0) {
    emit('updateElement', { ...shapeConfig.value })
  }
}

function updateImage() {
  if (Object.keys(imageConfig.value).length > 0) {
    const updates = {
      ...imageConfig.value,
      filter: filterMap[imageConfig.value.filter] || 'none'
    }
    emit('updateElement', updates)
  }
}

function toggleTextStyle(style) {
  if (textConfig.value) {
    textConfig.value[style] = !textConfig.value[style]
    updateText()
  }
}

/* ---------- 监听选中元素变化 ---------- */
watch(() => props.selectedElements, () => {
  updateTextConfig()
  updateShapeConfig()
  updateImageConfig()
}, { immediate: true, deep: true })

watch(() => props.selectedText, () => {
  updateLocalTextConfig()
}, { immediate: true })
</script>

<style scoped>
.floating-toolbar {
  position: absolute;
  background: white;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  padding: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  max-width: 500px;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-right: 1px solid #eee;
}

.toolbar-section:last-child {
  border-right: none;
}

.toolbar-section label {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
}

.toolbar-section select,
.toolbar-section input[type="number"],
.toolbar-section input[type="color"] {
  height: 24px;
  border: 1px solid #dcdfe6;
  border-radius: 3px;
  padding: 0 4px;
  font-size: 12px;
}

.toolbar-section input[type="number"] {
  width: 50px;
}

.toolbar-section input[type="color"] {
  width: 30px;
  padding: 0;
}

.toolbar-section input[type="range"] {
  width: 60px;
}

.toolbar-btn {
  width: 24px;
  height: 24px;
  border: 1px solid #dcdfe6;
  border-radius: 3px;
  background: white;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.toolbar-btn:hover {
  background: #f5f7fa;
}

.toolbar-btn.active {
  background: #409eff;
  color: white;
  border-color: #409eff;
}

.toolbar-btn.danger {
  color: #f56c6c;
  font-size: 14px;
}

.toolbar-btn.danger:hover {
  background: #fef0f0;
  border-color: #f56c6c;
}
</style>