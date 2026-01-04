# 🚀 감린이 로컬 서버 실행 가이드

## ⚠️ CORS 오류 해결

브라우저에서 로컬 파일(`file://`)을 직접 열면 CORS 오류가 발생합니다.
반드시 **로컬 HTTP 서버**를 실행해야 합니다.

---

## 🔧 서버 실행 방법

### 방법 1: 배치 파일 실행 (Windows)

프로젝트 폴더에서 `start-server.bat` 파일을 더블클릭하세요.

또는 명령 프롬프트에서:
```batch
start-server.bat
```

### 방법 2: 쉘 스크립트 실행 (Mac/Linux)

터미널에서:
```bash
chmod +x start-server.sh
./start-server.sh
```

### 방법 3: 직접 실행

**Python 3 (권장)**
```bash
python -m http.server 8000
```

**Node.js (http-server)**
```bash
npm install -g http-server
http-server -p 8000
```

**PHP**
```bash
php -S localhost:8000
```

---

## 🌐 접속

서버 실행 후 브라우저에서:

```
http://localhost:8000
```

---

## 🧪 KAM 기능 테스트

### 1. 브라우저 콘솔에서 테스트

`F12` 개발자 도구 → Console 탭:

```javascript
// KAM 모드 시작
enterKAMMode();

// KAM 통계 확인
getKAMStats();

// KAM 모드 종료
exitKAMMode();
```

### 2. 임시 테스트 버튼 추가

브라우저 개발자 도구 → Console 탭에서 실행:

```javascript
// 화면 우측 하단에 테스트 버튼 추가
const btn = document.createElement('button');
btn.textContent = '📝 KAM 실전 훈련';
btn.style.cssText = `
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  padding: 15px 30px;
  background: #9333ea;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(147,51,234,0.3);
`;
btn.onclick = () => enterKAMMode();
document.body.appendChild(btn);
```

---

## 🛑 서버 종료

터미널/명령 프롬프트에서 `Ctrl + C`를 누르세요.

---

## 🐛 문제 해결

### Python이 없는 경우

**Python 설치**: https://www.python.org/downloads/

설치 후 명령 프롬프트에서 확인:
```bash
python --version
```

### 포트 충돌 (8000 포트 사용 중)

다른 포트 사용:
```bash
python -m http.server 3000
# 접속: http://localhost:3000
```

### 방화벽 차단

Windows 방화벽에서 Python 허용 필요

---

## 📝 개발 워크플로우

1. **서버 시작**: `start-server.bat` 실행
2. **브라우저 접속**: `http://localhost:8000`
3. **개발/테스트**: 코드 수정
4. **새로고침**: `F5` (브라우저)
5. **종료**: `Ctrl + C` (터미널)

---

## 🎯 다음 단계

서버 실행 후:

1. ✅ API 키 설정 (설정 메뉴)
2. ✅ `enterKAMMode()` 실행
3. ✅ KAM 사례 선택
4. ✅ Step 1 (Why) 작성 → AI 평가
5. ✅ Step 2 (How) 작성 → 최종 평가

---

## 💡 팁

- **VS Code 사용자**: "Live Server" 확장 설치 권장
- **자동 새로고침**: Browser-sync 사용 권장
- **배포**: GitHub Pages에 푸시하면 자동 배포

---

현재 서버 실행 중: ✅
접속 주소: http://localhost:8000

**즐거운 개발 되세요!** 🎉
