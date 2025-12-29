# CafeManager 네이버 세션 관리 동작 원리 (기술 분석서)

> 목적: CafeManager(Next.js + NestJS + Prisma + BullMQ + Playwright)에서 **네이버 계정 연동과 세션 재사용**이 어떤 원리로 동작하는지,
> 그리고 운영/확장 시 주의해야 할 포인트를 **단일 기준 문서(SSOT)**로 정리한다.

---

## 용어 요약 (먼저 읽기)

- **네이버 연동**: OAuth 토큰 발급이 아니라, **Playwright로 네이버 웹 로그인 → 세션(쿠키/스토리지) 생성 → 저장 → 재사용**을 의미한다.
- **세션의 실체**: 네이버 로그인 상태는 결국 **브라우저 쿠키(NID_AUT/NID_SES 등) + 스토리지**로 구성된다.
- **만료 주체**: 세션 만료 시점은 기본적으로 **네이버 정책/보안 상태**에 의해 결정되며, 운영자는 **만료를 감지/복구하는 전략**을 관리한다.

---

## 1️⃣ 사용자가 네이버 계정 연동을 할 때 실제 동작 원리

### 1-1. 네이버 연동 버튼 클릭 시

**시퀀스**

```text
[사용자] "네이버 계정 연동" 클릭
    │
    ▼
[Frontend] POST /api/naver-sessions { naverAccountId }
    │
    ▼
[NestJS API] NaverSessionService.create()
    ├─ NaverAccount 소유권 검증
    ├─ 프로필 디렉토리 키 생성: "naver-{loginId}-{uuid8자리}"
    ├─ NaverSession 레코드 생성 (status: PENDING)
    └─ INIT_SESSION Job 생성 → BullMQ 큐 enqueue
    │
    ▼
[Worker] JobProcessor.handleInitSession()
    ├─ (옵션) 암호화된 비밀번호 복호화 (설계에 따라 달라짐)
    ├─ BrowserManager.getContext(profileDir)
    ├─ NaverCafeClient.login(id, pw)
    └─ 성공 시: status → HEALTHY, state.json 저장/갱신
```

---

### 1-2. OAuth vs Playwright 로그인 (왜 Playwright인가?)

| 항목 | 네이버 OAuth | Playwright 자동화 |
|------|-------------|------------------|
| 사용 가능 기능 | 프로필/메일 등 공식 API 범위 | **글쓰기/삭제/내가 쓴 글 조회** 등 웹 조작 포함 |
| 카페 게시글 작성 | ❌ (공식 API 제한) | ✅ |
| 세션 형태 | Access Token + Refresh Token | 브라우저 쿠키 기반(NID_AUT, NID_SES 등) |
| 정책/리스크 | 공식 허용 | 그레이존(자동화 탐지/제한 가능) |

**CafeManager가 Playwright를 쓰는 이유**
- 네이버 카페 공식 API는 **가입/멤버 관리 수준**으로 제한되는 경우가 많다.
- **게시글 작성/삭제/목록 동기화** 등 운영 핵심 기능은 대체로 웹 UI 자동화가 현실적이다.

---

## 2️⃣ Playwright가 네이버에 로그인하는 실제 과정

### 2-1. 상세 시퀀스

```text
[Worker] handleInitSession() 시작
    │
    ├─① Chromium 브라우저 실행 (headless: true)
    │
    ├─② BrowserContext 생성 (프로필 기반)
    │   ├─ 경로: $NAVER_PROFILE_DIR/{profileDir}/
    │   ├─ 기존 state.json 있으면 로드 → 세션 복원
    │   └─ 없으면 새 컨텍스트 생성
    │
    ├─③ 네이버 로그인 페이지 접근
    │   └─ page.goto('https://nid.naver.com/nidlogin.login')
    │
    ├─④ ID/PW 입력 (봇 감지 우회)
    │   ├─ 클립보드 방식 우선 시도 (clipboard.writeText → Ctrl+V)
    │   └─ 실패 시 page.fill() 사용
    │
    ├─⑤ 로그인 버튼 클릭
    │   └─ page.click('#log\.login')
    │
    ├─⑥ 결과 대기/분기
    │   ├─ 성공: waitForURL('https://www.naver.com/**') 또는 보호 페이지 접근 성공
    │   ├─ CAPTCHA: #captcha 요소 감지 → CHALLENGE_REQUIRED
    │   ├─ 2FA: [class*="two_factor"] 감지 → CHALLENGE_REQUIRED
    │   └─ 에러: .error_message 텍스트 파싱 → LOGIN_FAILED 등
    │
    └─⑦ 성공 판별(복합)
        ├─ URL이 nidlogin 페이지가 아님
        ├─ 로그인 폼(#id, #pw) 요소 없음
        └─ 쿠키 NID_AUT + NID_SES 존재(보조)
```

### 2-2. 로그인 성공 판별 기준(코드 개념)

```text
// naver-cafe-client.ts isLoggedIn() 로직 개념
1) URL 기반: page.url()에 'nidlogin.login' 미포함
2) DOM 기반: #id, #pw, input[type="password"] 요소 없음
3) 쿠키 기반: NID_AUT + NID_SES 존재(보조)
```

> 운영 팁: 단순히 “네이버 메인으로 이동”만으로 HEALTHY 처리하지 말고,  
> **카페 글쓰기 페이지 같은 보호 페이지** 접근까지 확인하는 것이 더 안전하다.

---

## 3️⃣ 네이버 세션(Session)은 정확히 무엇인가?

### 3-1. 네이버 세션의 실체

**네이버 인증 세션 = 브라우저 쿠키(핵심) + 일부 스토리지**

| 쿠키명 | 역할 | 만료(경향) |
|--------|------|-----------|
| `NID_AUT` | 인증 토큰(핵심) | 로그아웃/보안 정책/기간 경과 |
| `NID_SES` | 세션 식별자 | 브라우저 종료/정책/기간 경과 |
| `NID_JKL` | 보안 토큰 | 로그인 세션 |
| 기타 | NAVER_ITEM, NAVER_LOCALE 등 | 다양 |

> **주의:** “~30일”은 관측치에 가깝고 고정값이 아니다.  
> 만료는 네이버 정책/보안 이벤트(비번 변경, 다른 환경 로그인 등)에 따라 더 빨라질 수 있다.

---

### 3-2. Playwright 용어 정리

| 용어 | 설명 | CafeManager 관점 |
|------|------|-----------------|
| `Browser` | Chromium 인스턴스 | 워커 프로세스에서 공유 가능 |
| `BrowserContext` | 독립된 브라우저 세션(쿠키/스토리지 격리) | 사용자/계정 단위로 분리 |
| `storageState` | 쿠키 + (로컬/세션)스토리지 스냅샷(JSON) | **state.json으로 저장/로드** |
| `userDataDir` | Chrome 전체 프로필(IndexedDB 포함) | 선택지(무겁지만 더 강력) |

**현재 문서의 기본 전략: `storageState`**
- `storageState`는 JSON 스냅샷이라 **가볍고 이식성이 높다**
- 다만 사이트별로 IndexedDB 의존이 생기면 `userDataDir`(persistent context) 고려가 필요할 수 있다.

---

### 3-3. CafeManager에서 세션은 어떻게 저장되는가?

**저장 구조**

```text
$NAVER_PROFILE_DIR/               # 환경변수 또는 ./playwright-profiles
  └─ naver-myid-a1b2c3d4/         # profileDir (NaverSession.profileDir)
       └─ state.json              # storageState 파일
```

**DB vs 파일시스템 역할 분담**

| 저장 위치 | 저장 항목 | 이유 |
|-----------|----------|------|
| **DB (NaverSession)** | profileDir, status, lastVerifiedAt, errorCode | 상태 추적/관리/조회 |
| **파일 (state.json)** | 쿠키/스토리지 | Playwright가 직접 사용 |
| **DB에 저장 금지** | 쿠키 원본, 비밀번호 평문 | 보안(세션 탈취/계정 탈취 위험) |

---

## 4️⃣ 연동 성공 이후의 세션 관리 방식

### 4-1. 글을 쓸 때마다 새로 로그인하는가?

**원칙: ❌ 매번 로그인하지 않는다 / ✅ 기존 세션 재사용**

```text
[CREATE_POST Job 실행]
  ├─ BrowserManager.getContext(profileDir)
  │   └─ state.json 로드 → 쿠키 복원
  ├─ 글쓰기 페이지 접근
  └─ 글쓰기 수행 (로그인 상태 유지)
```

**장점/단점**

| 장점 | 단점 |
|------|------|
| 로그인 시도 최소화 → 봇 탐지 위험 감소 | state.json 파일 의존 |
| 작업 속도 향상 | 파일 손상 시 재연동 필요 |
| CAPTCHA/2FA 발생 확률 감소 | 서버 이관/스케일 아웃 시 스토리지 설계 필요 |

---

### 4-2. 세션의 유효기간은 어떻게 결정되는가?

**핵심: 만료는 “운영자가 정하는 것”이 아니라, 네이버가 결정한다.**  
운영자는 **만료를 감지하고 복구하는 정책**을 설계한다.

| 원인 | 결과 | 권장 대응 |
|------|------|----------|
| 쿠키 만료/보안 로그아웃 | 로그인 페이지로 리다이렉트 | AUTH_EXPIRED 처리 → (조건부) 재로그인 |
| 비밀번호 변경 | 세션 무효화/로그인 실패 | LOGIN_FAILED → 사용자 재입력 |
| CAPTCHA/2FA 요구 | 자동 복구 불가 | CHALLENGE_REQUIRED → 사용자 재연동 유도 |
| 워커 재시작 | 메모리 컨텍스트 소멸 | state.json로 복원 |
| state.json 삭제/손상 | 세션 영구 손실 | 재연동 필요 |

---

### 4-3. 세션 만료는 어떻게 감지하는가?

**감지 기준(권장: URL + DOM + 결과 기반의 복합 판단)**

```text
[CREATE_POST 실행 중]
  1) URL: 'nidlogin'으로 이동/리다이렉트 → AUTH_EXPIRED
  2) DOM: 로그인 폼/캡차/2FA 화면 감지 → CHALLENGE_REQUIRED
  3) 결과: 게시 버튼 후 권한/로그인 요구 오류 → PERMISSION_DENIED or AUTH_EXPIRED
```

**에러 분류 예시**

```text
classifyErrorCode(errorMessage) → ErrorCode
  ├─ AUTH_EXPIRED          # 세션 만료
  ├─ CHALLENGE_REQUIRED    # CAPTCHA/2FA
  ├─ LOGIN_FAILED          # 자격 증명 실패/비번 변경 등
  ├─ PERMISSION_DENIED     # 카페 권한 없음
  ├─ RATE_LIMIT            # 요청 제한
  ├─ UI_CHANGED            # 네이버 UI 변경
  └─ UNKNOWN
```

**오판 리스크**
- 만료 아닌데 만료로 오판 → 불필요한 재로그인 반복 → 탐지 리스크 증가
- 만료인데 미감지 → 실패 무한 반복 → 비용/장애 증가

---

## 5️⃣ 연동된 네이버 계정은 실제로 어떻게 관리되는가?

### 5-1. 사용자 1명 = 네이버 계정 N개 가능

```text
[User]
 ├─ NaverAccount #1 (shop_main)
 │   └─ NaverSession (profileDir: naver-shop_main-abc123)
 └─ NaverAccount #2 (shop_sub)
     └─ NaverSession (profileDir: naver-shop_sub-def456)
```

**멀티 계정 핵심 포인트**
- 계정별 **프로필/세션 완전 분리** → 쿠키 충돌 방지
- Job payload에 `naverAccountId`를 명시해 **어떤 계정으로 실행할지** 확정해야 한다.

---

### 5-2. DB(NaverSession) 핵심 필드(권장)

| 필드 | 역할 |
|------|------|
| `naverAccountId` | 연결 계정 FK |
| `profileDir` | 세션 파일 위치 키 |
| `status` | PENDING / HEALTHY / EXPIRED / CHALLENGE_REQUIRED / ERROR |
| `lastVerifiedAt` | 마지막 “사용 가능” 확인 시각 |
| `lastCheckedAt` | 마지막 “검증 시도” 시각 |
| `errorCode` / `errorMessage` | 장애 원인 파악 |
| `naverNickname` | 표시/검증용(옵션) |

**상태 흐름 예시**

```text
PENDING → HEALTHY
HEALTHY → (AUTH_EXPIRED) EXPIRED
HEALTHY → (CHALLENGE_REQUIRED) CHALLENGE_REQUIRED
HEALTHY → (LOGIN_FAILED) ERROR
CHALLENGE_REQUIRED → (사용자 재연동 성공) HEALTHY
EXPIRED → (재로그인 성공) HEALTHY
```

---

### 5-3. Worker 관점 사용 흐름

```text
[CREATE_POST Job 수신]
  ├─ payload.naverAccountId 확인
  ├─ 해당 계정의 세션 조회(status=HEALTHY?)
  │   ├─ YES → context 로드 후 실행
  │   └─ NO  → 즉시 실패 + 사용자에게 재연동 유도
  └─ 에러 발생 시
      ├─ errorCode 분류
      ├─ 세션 상태 전환(transitionSessionStatus)
      └─ Job/Run 로그 기록
```

**만료/챌린지 발생 시 UX**
1) Job 실패 + `errorCode` 기록
2) `NaverSession.status` 전환(EXPIRED/CHALLENGE_REQUIRED)
3) 프론트에서 상태를 **즉시 경고 표시**
4) “재연동” 버튼 제공 → INIT_SESSION 재실행

---

## 6️⃣ 세션 “주기 관리”는 필요한가?

### 6-1. 결론
- **매일 강제 로그인**(세션 초기화)은 권장하지 않는다. (탐지 위험 증가)
- 대신 **하루 1회(또는 작업 전) ‘세션 건강검진(verify)’**를 권장한다.

### 6-2. 권장 정책(예시)
- `VERIFY_SESSION` Job: 보호 페이지 접근으로 로그인 상태만 확인
  - 정상 → `lastVerifiedAt` 갱신 유지
  - 로그인 리다이렉트 → EXPIRED 전환 후 재연동 유도/조건부 재로그인

---

## 7️⃣ 보안 관점에서 반드시 지켜야 할 원칙

### 7-1. ID/PW 저장 리스크
- DB에 비밀번호를 저장하는 순간:
  - 키 관리(Secrets Manager), 접근 통제, 감사 로그가 필수로 요구된다.
- 가능하다면 장기적으로 “비밀번호 저장 없이 사용자 재연동 UX”도 고려해야 한다.

### 7-2. 쿠키/세션의 외부 노출 금지
| 금지 패턴 | 위험 |
|----------|------|
| API 서버가 state.json 읽기 | 쿠키 노출 → 세션 하이재킹 |
| 쿠키를 DB에 저장 | 유출 시 계정 탈취 |
| 쿠키를 프론트로 전달 | XSS로 즉시 탈취 |

**원칙**
- 세션 실체(state.json)는 **Worker가 있는 런타임에서만 접근**
- API는 `profileDir` 같은 포인터와 상태만 관리

### 7-3. 파일 권한/이관/백업
```text
./playwright-profiles/
  └─ naver-{loginId}-{uuid}/
       └─ state.json  ← 핵심 자산
```

- 권장 권한:
  - `chmod 700` profiles dir
  - `chmod 600` state.json
- 백업 시 **암호화 필수**
- `.gitignore`에 포함(절대 커밋 금지)

---

## 8️⃣ 서버 이관/스케일 아웃 시 세션 이슈

| 상황 | 문제 | 해결 |
|------|------|------|
| Worker 서버 교체 | state.json 없음 | 공유 스토리지(NFS/S3+암호화) 또는 안전한 이관 |
| Worker 스케일 아웃 | 동일 프로필 동시 접근 | 프로필당 1 워커 보장 / 분산 락 |
| 컨테이너 재생성 | 로컬 파일 소멸 | Volume 마운트/영구 스토리지 |

> 스케일 아웃을 하려면 “프로필 단위 락”이 사실상 필수다.

---

## 9️⃣ 최종 요약

### 핵심 요약
- **네이버 연동의 본질**: Playwright 로그인 → 세션(쿠키/스토리지) 저장 → Job 실행에 재사용
- **세션 만료 주체**: 네이버(운영자는 감지/복구 정책을 관리)
- **안정 운영 포인트**: 에러 분류/상태 전환/가시화 + (선택) 세션 건강검진

### 잘못 설계하면 터지는 TOP 3
1) 쿠키를 DB에 저장 → 유출 시 계정 탈취
2) 여러 워커가 같은 프로필에 동시 접근 → 랜덤 로그아웃/충돌
3) 만료 감지 실패 → Job 무한 재시도/장애 확대
