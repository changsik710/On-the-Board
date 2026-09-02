# On the B.O.A.R.D · 학생선수 성장 포트폴리오

서울체육중학교 다이빙부 학생선수의 훈련·대회 동작 수행을 영상으로 기록하고,
실시간 피드백과 성장 데이터를 누적하는 웹 애플리케이션입니다.

2026 학생특기지도(체육)연구 「On the B.O.A.R.D: 학생선수 도약을 위한 성장코칭 모델」의
A(Analysis) 영역 실행 도구로 설계되었으며, O(Ownership)·R(Resilience)·D(Development) 영역의
데이터도 함께 수집합니다.

---

## 1. 준비물

| 항목 | 용도 | 비용 |
|---|---|---|
| GitHub 계정 | 앱 화면 배포 | 무료 |
| Supabase 계정 | 로그인·데이터베이스·영상 저장·실시간 통신 | 무료 플랜 |

---

## 2. Supabase 설정 (약 10분, 1회만)

### 2-1. 프로젝트 만들기
1. supabase.com 접속 → **Start your project** → GitHub 계정으로 로그인
2. **New project** 클릭
3. Name `on-the-board`, Database Password 입력(별도 보관), Region **Northeast Asia (Seoul)** 선택
4. **Create new project** → 약 2분 대기

### 2-2. 데이터베이스 만들기
1. 왼쪽 메뉴 **SQL Editor** → **New query**
2. `sql/schema.sql` 파일 내용을 **전체 복사해서 붙여넣기**
3. 오른쪽 아래 **Run** 클릭 → `Success` 표시 확인

이 한 번의 실행으로 테이블 6개, 보안 정책, 영상 저장소, 실시간 기능이 모두 만들어집니다.

### 2-3. 접속 키 복사
1. 왼쪽 아래 **Project Settings** → **API**
2. **Project URL** 과 **anon public** 키를 복사
3. `js/config.js` 파일을 열어 아래 두 줄을 바꿉니다.

```js
SUPABASE_URL: "https://xxxxx.supabase.co",
SUPABASE_ANON_KEY: "eyJhbGci....",
```

> **service_role 키는 절대 넣지 마세요.** anon public 키만 사용합니다.
> anon 키는 공개되어도 안전하도록 데이터베이스 보안 정책(RLS)이 이미 걸려 있습니다.

### 2-4. 메일 인증 끄기 (선택, 권장)
학생들이 가입 후 바로 쓰게 하려면
**Authentication → Providers → Email → Confirm email** 을 꺼두세요.

---

## 3. GitHub 연결 및 배포

저장소 이름은 **On-the-Board** 로 만드세요.
(GitHub 저장소 이름에는 공백을 쓸 수 없어 하이픈으로 연결합니다. 표시 이름은 앱 안에서 `On the B.O.A.R.D`로 나옵니다.)

### 방법 A. 웹 브라우저만으로 (터미널 불필요, 권장)

1. GitHub 로그인 → 오른쪽 위 **+** → **New repository**
2. Repository name: `On-the-Board` / **Public** 선택 / **Create repository**
3. 다음 화면에서 **uploading an existing file** 클릭
4. 압축을 푼 폴더 안의 **모든 파일과 폴더를 드래그**해서 올림
   (`index.html`, `hash.html`, `README.md`, `css`, `js`, `sql`, `.github` 전부)
5. 아래 **Commit changes** 클릭
6. 상단 **Settings** → 왼쪽 **Pages**
7. Source: `Deploy from a branch` / Branch: `main` / 폴더: `/ (root)` → **Save**
8. 1~2분 뒤 주소 생성 → `https://<본인아이디>.github.io/On-the-Board/`

> `.github` 폴더가 드래그로 안 올라가면(숨김 폴더 취급) 무시해도 됩니다.
> 방법 A는 이 폴더가 없어도 정상 배포됩니다.

### 방법 B. Git 명령어 사용

```bash
cd On-the-Board
git init
git add .
git commit -m "On the B.O.A.R.D 최초 배포"
git branch -M main
git remote add origin https://github.com/<본인아이디>/On-the-Board.git
git push -u origin main
```

푸시 후 **Settings → Pages → Source** 를 `GitHub Actions` 로 지정하면
`.github/workflows/deploy.yml` 이 동작하여 코드를 수정해 push할 때마다 자동 재배포됩니다.

### 이후 수정 방법
GitHub 저장소에서 파일을 클릭 → 연필 아이콘 → 수정 → **Commit changes**
1~2분 뒤 사이트에 자동 반영됩니다.

---

## 4. 첫 실행 순서

1. 배포 주소 접속 → **가입** 탭에서 지도교사 본인 계정 먼저 생성
2. Supabase → **SQL Editor** 에서 아래 실행 (본인을 관리자로 지정)

```sql
update profiles set role = 'admin'
where id = (select id from auth.users where email = '지도교사이메일');
```

3. 관리자 비밀번호 변경 (**필수**)
   - `hash.html` 을 브라우저로 열어 새 비밀번호 입력 → 해시값 복사
   - Supabase → **Table Editor** → `app_config` → `admin_pw_hash` 값에 붙여넣기 → 저장
   - 초기값은 `board2026!` 입니다. **반드시 바꾸세요.**
4. 학생들에게 배포 주소 안내 → 각자 가입

---

## 5. 화면 구성

| 탭 | 기능 | 연구 영역 |
|---|---|---|
| 홈 | 개인 KPI, 경기 전 루틴 4국면 체크, 긴장도·자신감·수면 기록, 공지 | B · R |
| 다이브 등록 | 수행일·훈련/대회·종목·기술번호·DD·훈련단계, 도약/회전/입수 자기평가, 3문 성찰, 영상 업로드 | A · O |
| 피드백 | 팀 전체 영상 목록, 0.25배속·프레임 이동, 타임스탬프 피드백, 실시간 반영 | A |
| 성장분석 | DD 추이, 분절 점수 전후 비교, 심리 변화 그래프, 2분할 영상 비교 | D · R |
| 관리자 | 비밀번호 인증, 부원 권한 관리, 공지 등록, CSV 내보내기, 기록 삭제 | 운영 |

---

## 6. 보안 구조

관리자 탭은 **이중 잠금**입니다.

1. **화면 잠금** — 입력한 비밀번호를 SHA-256으로 변환해 저장된 해시와 대조.
   비밀번호 원문은 코드·데이터베이스 어디에도 없습니다.
2. **서버 권한** — 실제 데이터 조작 권한은 `profiles.role = 'admin'` 계정에만 부여.
   데이터베이스의 RLS 정책이 판정하므로 화면을 우회해도 권한 없는 조작은 차단됩니다.

브라우저 앱에서 비밀번호만으로 잠그는 방식은 실제로는 뚫립니다.
그래서 화면 잠금과 서버 권한을 분리했습니다.

**영상 보호**: 저장소는 비공개이며, 로그인한 팀원에게만 1시간짜리 임시 주소가 발급됩니다.
저장소를 Public으로 두어도 영상·학생 데이터는 GitHub에 올라가지 않습니다.

---

## 7. 자주 묻는 문제

| 증상 | 원인과 해결 |
|---|---|
| 화면이 하얗게 나옴 | `js/config.js` 의 URL·키 미입력. 브라우저 F12 → Console 확인 |
| 로그인 후 아무것도 안 보임 | `schema.sql` 미실행. SQL Editor에서 다시 Run |
| 영상 업로드 실패 | 200MB 초과이거나 버킷 미생성. 링크 방식으로 등록 |
| 실시간 표시등이 회색 | 11번 항목(publication) 실행 여부 확인 |
| 관리자 인증은 되는데 권한 없다고 나옴 | 4번의 `update profiles set role='admin'` 미실행 |
| 무료 용량 초과 | 학기말 CSV 내보내기 후 오래된 영상 삭제, 또는 링크 방식 병행 |

---

## 8. 연구 활용 안내

- **CSV 내보내기**: `dives`, `feedbacks`, `checkins` 3종을 학기말에 내려받아
  SPSS·엑셀로 사전-사후 비교 분석에 바로 사용할 수 있습니다.
- **자기주도성 지표**: 피드백은 작성자 역할이 자기/동료/지도자/전문가로 구분 저장됩니다.
  학기 초 대비 학기 말 **자기·동료 피드백 비율 증가**를 O(Ownership) 영역의 정량 근거로 쓸 수 있습니다.
- **회복탄력성 지표**: 매일 기록되는 긴장도·자신감 값은 사전·사후 2회 검사로는 볼 수 없는
  **시계열 변화**를 보여줍니다. 대회 전후 구간을 잘라 비교하면 R 영역 분석이 됩니다.
- **개인정보**: 영상 촬영 및 온라인 저장에 대한 학생·보호자 사전 동의서를 받으시고,
  연구 윤리 항목으로 보고서에 명시하시기 바랍니다.

---

문의: 서울체육중학교 다이빙부 지도교사
