import { defineConfig } from 'vite'
import { readFileSync } from 'fs'
import { join } from 'path'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: {
      key: readFileSync(join(__dirname, 'certs', 'localhost-key.pem')),
      cert: readFileSync(join(__dirname, 'certs', 'localhost.pem'))
    }
  }
})