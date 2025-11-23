/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors');

module.exports = {
  content: [
    "./index.html",
    "./js/**/*.js",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        serif: ['Ridibatang', 'Merriweather', 'serif'], // 본문용 세리프 (이롭게 바탕체)
      },
      colors: {
        // Phase 4.0: Digital Library 컬러 시스템
        // 기본 gray를 stone(Warm Gray)으로 덮어쓰기
        gray: colors.stone,
        // blue를 차분한 indigo로 변경
        blue: colors.indigo,
      },
    },
  },
  plugins: [],
}
