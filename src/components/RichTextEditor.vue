<!-- RichTextEditor.vue -->
<template>
  <div
    class="rich-text-box"
    :style="{
      width: width + 'px', 
      minHeight: height + 'px',
      position: 'relative'
    }"
    @mousedown.stop="handleEditorMouseDown"
  >
    <editor-content
      :editor="editor"
      class="rich-text-content"
      @keydown="handleKeyDown"
    />
  </div>
</template>

<script setup>
import { nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { FontFamily } from '@tiptap/extension-font-family'
import Underline from '@tiptap/extension-underline' // 重新导入 Underline

const emit = defineEmits(['update', 'exit'])

const props = defineProps({
  html: { type: String, default: '' },
  width: { type: Number, default: 200 },
  height: { type: Number, default: 40 }
})

// 配置 StarterKit 排除 underline，然后单独添加
const CustomStarterKit = StarterKit.configure({
  underline: false // 禁用 StarterKit 中的 underline
})

const editor = useEditor({
  content: props.html,
  editable: true,
  extensions: [
    CustomStarterKit,
    TextStyle,
    Color,
    FontFamily,
    Underline, // 单独添加 underline 扩展
  ],
  onUpdate: ({ editor }) => {
    const html = editor.getHTML()
    emit('update', html)
  }
})

// 暴露样式操作方法
const toggleBold = () => {
  editor.value.chain().focus().toggleBold().run()
}

const toggleItalic = () => {
  editor.value.chain().focus().toggleItalic().run()
}

const toggleUnderline = () => {
  editor.value.chain().focus().toggleUnderline().run()
}

const toggleStrike = () => {
  editor.value.chain().focus().toggleStrike().run()
}

const setColor = (color) => {
  editor.value.chain().focus().setColor(color).run()
}

const setFontFamily = (fontFamily) => {
  editor.value.chain().focus().setFontFamily(fontFamily).run()
}

// 暴露编辑器实例和方法
defineExpose({
  focus,
  editor,
  toggleBold,
  toggleItalic,
  toggleUnderline,
  toggleStrike,
  setColor,
  setFontFamily
})
</script>

<style scoped>
.rich-text-box {
  background: white;
  line-height: 1.4;
  cursor: text;
  user-select: text;
  border: 1px solid #409eff;
  border-radius: 4px;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}
.rich-text-content {
  width: 100%;
  height: 100%;
  padding: 8px;
  outline: none;
  overflow: auto;
  word-break: break-word;
  white-space: pre-wrap;
  box-sizing: border-box;
  pointer-events: auto;
  background: white;
}

:deep(.ProseMirror) { 
  outline: none; 
  min-height: 100%;
  padding: 0;
  box-sizing: border-box;
  background: white;
  cursor: text;
  text-align: left !important;
}

:deep(.ProseMirror:focus) {
  outline: none;
}

:deep(.tiptap) { 
  outline: none; 
  min-height: 100%;
  text-align: left !important;
}

:deep(.ProseMirror p) {
  margin: 0;
  padding: 0;
  text-align: left !important;
}

:deep(.ProseMirror p.is-editor-empty:first-child::before) {
  color: #adb5bd;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}
</style>