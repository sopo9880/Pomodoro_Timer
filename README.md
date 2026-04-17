# 🌸 Bloomodoro: Elegant Focus Rhythm

**Bloomodoro**는 감각적인 디자인과 강력한 백그라운드 안정성을 결합한 차세대 웹 포모도로 타이머입니다. 단순한 시간 측정을 넘어, 모바일 브라우저의 제약을 극복하고 사용자의 몰입(Flow)을 깨지 않는 최적의 사용자 경험을 제공합니다.


## ✨ 핵심 차별점 (Core Highlights)

### 1. 강력한 백그라운드 생존력 (Background Persistence)
모바일 OS(iOS/Android)의 엄격한 배터리 관리 정책을 우회하기 위해 **'10Hz 초저주파 무음 오디오'** 및 **'아날로그 째깍 소리(ASMR)'** 기법을 도입했습니다. 화면이 꺼져도 타이머가 중단되지 않고 정해진 시간에 정확히 알림을 보냅니다.

### 2. 잠금 화면 실시간 컨트롤 (Media Session API)
음악 재생 앱처럼 잠금 화면이나 상단 알림창에서 타이머의 남은 시간을 실시간으로 확인하고, 시작/일시정지/건너뛰기를 즉시 조작할 수 있습니다.

### 3. 하이브리드 타이머 아키텍처
- **Web Worker**: 메인 스레드 정지 시에도 정확한 연산을 유지하여 타이머 드리프트를 원천 차단합니다.
- **State Recovery**: 앱이 완전히 종료되었다가 다시 열려도 서버 시간 기반으로 누락된 세션을 계산하여 복구합니다.

### 4. 설치형 PWA (Progressive Web App)
- **Installable**: 홈 화면에 추가하여 네이티브 앱과 동일한 경험을 제공합니다.
- **Offline Ready**: 서비스 워커(Service Worker)를 통해 네트워크 연결 없이도 완벽하게 동작합니다.

---

## 🚀 주요 기능 (Features)

- **세밀한 모드 설정**: 집중(Pomodoro), 짧은 휴식, 긴 휴식 모드 및 사이클 관리.
- **나만의 리듬**: Classic(25/5), Flow(30/7), Deep(50/10) 프리셋 및 커스텀 시간 조정.
- **시청각 피드백**: 맑고 선명한 알림음 톤 선택, 안드로이드 전용 진동 패턴 지원.
- **데스크톱 최적화**: 미니 타이머(Document Picture-in-Picture) 창을 통한 상시 표시 기능.
- **통계 및 기록**: 오늘 하루 동안의 집중 누적 시간과 세션 로그 자동 기록.

---

## 🛠 기술 스택 (Tech Stack)

- **Frontend**: Vanilla JavaScript (ES6+), CSS3 (Modern Glassmorphism UI)
- **Background**: Web Workers API, Service Workers
- **Audio**: Web Audio API, Media Session API
- **Storage**: LocalStorage (Persistent State Management)
- **Build/Deploy**: GitHub Actions, GitHub Pages

---

## 📦 설치 및 실행 (Setup)

정적 파일 구조이므로 어떤 서버 환경에서도 동작하지만, PWA와 모바일 테스트를 위해 로컬 서버 실행을 권장합니다.

```bash
# 로컬 서버 실행 (Node.js 필요)
node server.js
```

이후 브라우저에서 `http://localhost:4173`으로 접속합니다.

---

## 📄 라이선스 및 제작
- **Author**: Gwonhc (Kwon Hee-chang), Dong-a University AI Dept.
- 본 프로젝트는 교육 및 개인 몰입 도구로서 오픈소스로 제공됩니다.

---

### 💡 Tip: 백그라운드 오디오 설정
모바일에서 안정적인 알림을 받으려면 **[설정] > [백그라운드 오디오 유지]** 토글을 켜주세요. 10Hz 초저주파 또는 아날로그 시계 소리를 통해 시스템의 절전 모드 진입을 효과적으로 방지합니다.
