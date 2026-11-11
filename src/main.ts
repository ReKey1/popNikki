import '@fontsource/archivo/400.css'
import '@fontsource/archivo/500.css'
import '@fontsource/archivo/600.css'
import '@fontsource/archivo/700.css'
import '@fontsource/bungee/400.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/rubik-spray-paint/400.css'
import './assets/main.css'

import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

const app = createApp(App)

// Pinia goes first: the router's guard reads the session store on the first navigation.
app.use(createPinia())
app.use(router)

// The first paint is the real page: at once for a member the device remembers, and after the
// session check for anyone else.
void router.isReady().then(() => app.mount('#app'))

// Kept out of the CSS the first paint waits for (see the file).
void import('./assets/fonts-japanese.css')
