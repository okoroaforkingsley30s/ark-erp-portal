import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import packageJson from './package.json' with { type: 'json' }

export default defineConfig({
base: './',

define: {
'__APP_VERSION__': JSON.stringify(packageJson.version),
},

plugins: [react()],

resolve: {
alias: {
'@': path.resolve(__dirname, 'src')
}
},

test: {
environment: 'node',
include: ['src/**/*.test.js'],
clearMocks: true,
coverage: {
provider: 'v8',
include: [
'src/lib/roleAccess.js',
'src/lib/workflowRules.js',
'src/lib/accounting.js',
'src/lib/fileValidation.js',
],
reporter: ['text', 'json', 'html'],
thresholds: {
statements: 70,
branches: 55,
functions: 25,
lines: 70,
},
},
}
})
