import {defineConfig} from 'vite';
export default defineConfig({base:process.env.VITE_BASE_PATH || '/admin/',build:{outDir:process.env.WEB_OUT_DIR || 'dist'},server:{proxy:{'/api':'http://127.0.0.1:4173'}}});
