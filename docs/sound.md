# 소리 목록

모든 소리는 코드로 만들어요(`garden/sfx.mjs`, 배경 소리는 `tools/make-ambience.py`). 내려받은 소리 파일이 없어서 저작권이나 출처 표기가 필요 없어요.
설정의 「소리」 스위치와 크기를 모든 소리가 따르고, 집중 중에는 정원 소리가 조용해요(세션 끝 종소리는 예외).

## 배경 소리 (백그라운드 오디오 유지)
`assets/audio/garden-ambience.mp3` — 약 96초의 이음매 없는 반복. 바람 소리, 가끔 멀리서 새소리, 아주 드물게 풍경 한 음. 크기는 약 -38 dBFS로 아주 작아요.
예전 `keepalive.mp3`(1시간짜리 400Hz 소리, 14MB)를 대체했어요. 다시 만들려면 `python3 tools/make-ambience.py`.

## 효과음
| 소리 | 언제 |
|---|---|
| `tap` | 버튼, 탭, 메뉴를 누를 때 |
| `toggleOn` / `toggleOff` | 설정 스위치를 켜고 끌 때 |
| `start` / `pause` / `reset` | 타이머 시작, 일시정지, 처음부터 |
| `complete-bright` / `complete-soft` / `complete-bell` | 세션이 끝났을 때(설정의 알림음 종류). 종류를 바꾸거나 크기 슬라이더를 놓으면 미리 들려줘요 |
| `place` / `plant` | 장식을 놓을 때 / 식물을 심을 때, 옮길 때 |
| `pickup` / `remove` | 집어 올릴 때 / 인벤토리로 회수할 때 |
| `buy` / `wear` / `recruit` | 구매, 옷 갈아입기, 동료 맞이하기 |
| `pet` | 동료를 눌렀을 때(동료마다 음높이가 달라요), 동료를 놓았을 때 |
| `sit` / `stand` | 앉을 때 / 일어날 때 |
| `ding` / `chime` / `splash` / `warm` / `pop` | 우편함 / 풍경 / 우물·새 물놀이대 / 모닥불 / 그네·차 |
| `discover` | 도감에 새로 기록될 때 |
| `unlock` | 새 구역이 열릴 때 |
| `nope` | (예비) 안 되는 동작 |
