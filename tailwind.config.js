/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors')

module.exports = {
  content: [
    "./index.html",
    "./js/**/*.js",
  ],
  safelist: [
    // Phase 4.0 Day 1: 버튼 클래스 보존
    'btn-ghost',
    'btn-outline',
    'btn-soft',
    'btn-primary',
    'btn-icon',
    // Phase 4.0: 난이도 버튼 색상 구분
    'btn-difficulty-easy',
    'btn-difficulty-medium',
    'btn-difficulty-hard',
    'btn-difficulty-skip',
  ],
  theme: {
    extend: {
      // Phase 4.0 Day 1: 타이포그래피 시스템
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        serif: ['Iropke Batang', 'IropkeBatang', 'Merriweather', 'serif'],
      },
      // Phase 4.0 Day 1: 컬러 시스템 - 원래 Gray 유지 (가독성 최우선)
      colors: {
        // Slate를 Primary 색상으로 사용
        primary: colors.slate,
      },
    },
  },
  plugins: [],
}
