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
      // 타이포그래피 시스템
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        serif: ['Iropke Batang', 'IropkeBatang', 'Merriweather', 'serif'],
      },
      // Warm & Neutral 컬러 시스템 (Notion/Claude 스타일)
      colors: {
        primary: colors.slate, // 차분한 Slate 톤
      },
    },
  },
  plugins: [],
}
