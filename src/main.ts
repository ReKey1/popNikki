import '@fontsource/archivo/400.css'
import '@fontsource/archivo/500.css'
import '@fontsource/archivo/600.css'
import '@fontsource/archivo/700.css'
import '@fontsource/bungee/400.css'
import '@fontsource/dela-gothic-one/400.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/rubik-spray-paint/400.css'
import '@fontsource/zen-kaku-gothic-new/400.css'
import '@fontsource/zen-kaku-gothic-new/500.css'
import '@fontsource/zen-kaku-gothic-new/700.css'
import './assets/main.css'

import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

const app = createApp(App)

// Pinia goes first: the router's guard reads the session store on the first navigation.
app.use(createPinia())
app.use(router)

// Wait for the session check, so the first paint is the real page instead of a loading state.
void router.isReady().then(() => app.mount('#app'))
