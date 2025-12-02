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
        serif: ['Ridibatang', 'Merriweather', 'serif'],
      },
      // Phase 4.0 Day 1: 컬러 시스템 - 따뜻한 Stone/Slate 뉴트럴 톤
      colors: {
        // Gray를 Stone으로 매핑 (따뜻한 회색)
        gray: colors.stone,
        // Blue를 Slate로 매핑 (차분한 블루그레이)
        primary: colors.slate,
      },
    },
  },
  plugins: [],
}
