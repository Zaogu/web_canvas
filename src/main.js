import { createApp } from 'vue'
import App from './App.vue'
import FloatingToolbar from './components/FloatingToolbar.vue'
import InfiniteCanvas from './components/InfiniteCanvas.vue'
import CanvasElement from './components/CanvasElement.vue'

const app = createApp(App)
app.component('FloatingToolbar', FloatingToolbar)
app.component('InfiniteCanvas', InfiniteCanvas)
app.component('CanvasElement', CanvasElement)
app.mount('#app')