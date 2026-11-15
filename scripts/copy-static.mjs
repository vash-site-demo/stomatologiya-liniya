import { cpSync } from 'node:fs';

// Копируем локальную библиотеку иконок, которую Vite не обрабатывает как модуль.
cpSync('vendor', 'dist/vendor', { recursive: true });
