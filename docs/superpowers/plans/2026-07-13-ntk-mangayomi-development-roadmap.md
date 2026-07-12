# NTK Mangayomi 확장 개발 로드맵

> **상태:** 조사·설계 계획 v0.2. 이 문서는 구현 순서와 승인 게이트를 정의하며, 코드 구현을 승인하는 문서가 아니다.

**목표:** 주소가 바뀔 수 있는 NTK 계열 사이트를 Mangayomi에서 사용할 수 있도록 Webtoon, Manhwa, Novel, Anime Source를 순서대로 독립 개발한다.

**개발 순서:** Webtoon → Manhwa → Novel → Anime

## 1. 확정된 원칙

- 네 콘텐츠 계층은 Source, 파서, 테스트 자료와 장애 기록을 분리한다.
- Webtoon과 Manhwa가 Mangayomi의 같은 `manga` 타입을 사용하더라도 파서를 공유하지 않는다.
- 사이트 주소를 파서 코드의 분기 조건으로 사용하지 않는다.
- 작품 URL과 회차 URL은 가능한 한 호스트를 제거한 상대 경로로 보관한다.
- 사용자가 Source 설정에서 접속 프로필 또는 사용자 지정 주소를 선택한다.
- 초기 버전에는 자동 도메인 전환을 넣지 않는다.
- 숫자 도메인의 다음 주소를 추측하지 않는다.
- Cloudflare 대응을 위해 FlareSolverr 또는 Byparr 같은 외부 서비스를 요구하지 않는다.
- 코드, 설정, 스캐폴딩을 생성하거나 수정하기 전에는 사용자에게 작업 범위를 설명하고 승인을 받는다.
- 기존 로컬 작업물을 확인해야 할 때는 먼저 사용자에게 알리고, 확인한 위치와 사용 범위를 보고한다.
- 사이트 계약은 현재 사이트에서 직접 추출한 요청과 응답만으로 먼저 작성한다.
- 과거 GitHub 구현과 저장 HTML은 현재 계약 작성이 끝난 뒤 차이를 확인하는 비교 자료로만 사용한다.
- 과거 API 경로, 선택자, fixture 또는 파싱 규칙을 현재 조사 입력으로 사용하거나 그대로 복사하지 않는다.

### 확정된 Webtoon 목록 범위

- 첫 Webtoon 버전부터 인기 목록, 최신 목록, 제목 검색과 전체 필터를 지원한다.
- 자유어 검색의 대상은 작품 제목으로 한정한다.
- 전체 필터는 사이트가 현재 제공하는 필터 항목과 값 전체를 의미한다.
- Legacy와 Next의 필터 이름이 비슷해도 요청 파라미터나 값 체계가 다르면 별도로 구현한다.
- 필터 항목과 값은 현재 사이트에서 확인한 뒤 확정하며 과거 코드나 이름만 보고 추측하지 않는다.

## 2. 확인된 사이트 계열

### Legacy 계열

- 현재 확인 주소: `https://newtoki1.org`
- 직접 HTTP 접근: 확인 당시 200
- Webtoon 목록 경로: `/webtoon`
- Manhwa 목록 경로: `/manhwa`
- Novel 목록 경로: `/novel`
- Anime 목록 경로: `/anime/updates`
- 과거 선택자 예시: `theme-detail-*`, `li.list-item`

### Next 계열

- 현재 확인 주소: `https://sbxh9.com`
- 직접 HTTP 접근: 확인 당시 200
- Webtoon 목록 경로: `/ing`
- Manhwa 목록 경로: `/manhwa/updates`
- Novel 목록 경로: `/novel`
- Anime 목록 경로: `/anime`
- 과거 선택자 예시: `hero-v2-*`, `li.ep-row-v2`

### Cloudflare가 적용된 Next 계열 후보

- 현재 확인 주소: `https://toki30.com`
- 일반 HTTP 요청: 확인 당시 403
- 저장된 HTML과 URL 형식은 Next 계열일 가능성이 높다.
- 동일 파서 사용 가능 여부는 아직 확정하지 않는다.
- Anime 목록 경로 후보: `/anime`
- Anime 상세 예시: `/anime/3217`

## 3. 도메인과 파서 분리 설계

Source 설정에서 다음 프로필을 제공하는 방향으로 설계한다.

- `Legacy`: 현재 Legacy 계열 기본 주소
- `Next Primary`: 현재 Next 계열 주 주소
- `Next Secondary`: 현재 Next 계열 보조 주소
- `Custom`: 사용자가 직접 입력한 주소

각 프로필은 개념적으로 다음 정보만 가진다.

- 요청에 사용할 `baseUrl`
- `legacy` 또는 `next` 파서 계열
- 콘텐츠 종류별 목록 경로

`baseUrl`은 요청 대상을 정할 뿐 파서 선택 기준이 아니다. 파서는 프로필의 계열 값으로 명시적으로 선택한다. 사용자 지정 주소는 사용자가 `baseUrl`과 `parserFamily`(`legacy` 또는 `next`)를 함께 지정한다. 초기 버전에서는 Custom 주소의 파서 계열을 자동 판별하거나 자동 변경하지 않는다.

설정은 Mangayomi의 Source 단위로 저장되므로 Webtoon, Manhwa, Novel, Anime에서 각각 지정해야 한다. 이 중복은 초기 버전에서 허용하며 전역 설정 동기화는 범위에서 제외한다.

## 4. 수정 클라이언트에서 유지할 다섯 기능

다음 기능은 확장과 별도로 수정 Mangayomi 클라이언트에서 유지하고 PR까지 진행할 예정이다.

1. Source WebView의 동적 URL 지원
2. `cf_clearance`와 문제 해결 WebView의 User-Agent 결합
3. Cloudflare 문제 해결 후 원래 요청 재시도
4. WebView가 반환한 문자열 및 JSON payload 보존
5. Source가 반환한 회차 순서 보존

CF 세션 안정화나 광범위한 headless 대응은 재현되는 구체적 문제가 생기기 전에는 추가하지 않는다. 위 다섯 기능의 클라이언트 PR 계획은 확장 기능 검증과 분리해서 관리한다.

### 2026-07-13 조사 기준 버전

- Mangayomi upstream 기본 브랜치: `main`
- Mangayomi upstream 기준 커밋: `c1302608767d6699c38ae40ce3c6c23c8e116a86`
- 기준 커밋 시각: `2026-06-29T14:33:16Z`
- 확인 당시 최신 릴리스: `v0.7.80` (`2026-06-07` 공개)
- 공식 확장 저장소 기준 커밋: `6004f1f8d1a56f882dadb734ce26f50c626a3850`
- 로컬 수정 클라이언트 브랜치: `codex/ntk-webview-ios-verify`
- 로컬 수정 클라이언트 기준 커밋: `43326992ae7252cb2840fddce020bab4f1f75d4e`
- 로컬 수정 클라이언트와 upstream `main`의 merge-base: `c1302608767d6699c38ae40ce3c6c23c8e116a86`
- 로컬 수정 클라이언트 Git 상태: 확인 당시 clean

확장 API와 수정 클라이언트 검증은 위 커밋을 기준으로 한다. 나중에 upstream을 갱신할 때는 기준 커밋과 검증 결과를 함께 갱신하며, 조사 도중 자동으로 최신 커밋을 따라가지 않는다.

## 5. 과거 GitHub 구현에서 확인한 내용

기준 저장소: `gilsek/ntk-mangayomi`

- 기준 커밋: `71674b6e` (`newtoki1.org` 전환)
- 주요 구현: `javascript/manga/src/ko/ntk.js`
- 테스트: `tests/ntk.test.js`
- 초기 설계: `docs/superpowers/specs/2026-07-10-ntk-mangayomi-extension-design.md`

현재 계약 작성 후 비교할 과거 단서:

- `/api/works`, `/api/manhwa-list` 목록 API 요청 형식
- 작품 및 회차 상대 경로 규칙
- Legacy와 Next의 개별 선택자 표본
- 리더 bootstrap의 `sourceWorkId`, `episodeId`, `imagesToken`, `viewerUrl` 필드
- 이미지 proof 및 `ad_ack_required` 흐름의 테스트 자료
- 문자열 또는 객체 형태 이미지 배열을 정규화한 테스트 사례

위 항목은 현재 사이트에서 같은 요청과 필드가 직접 확인되기 전에는 요구사항, 구현 계약 또는 테스트 fixture로 채택하지 않는다.

폐기하거나 다시 설계할 부분:

- 기본 주소 하드코딩
- 하나의 함수에서 Legacy와 Next 선택자를 차례로 시도하는 혼합 파서
- Webtoon, Manhwa, Novel 처리 책임의 집중
- 후보 API를 무차별적으로 재시도하는 방식
- 데스크톱 User-Agent 전제
- 실제 사이트가 아닌 합성 HTML만으로 완료를 판단하는 테스트

## 6. Webtoon 조사 범위

Webtoon은 다음 세 기능을 각각 Legacy와 Next로 나눠 조사한다.

### 기능 A: 작품 목록

확인 항목:

- 인기 목록, 최신 목록과 제목 검색이 각각 어떤 요청을 사용하는가
- HTML 목록인지 JSON API인지
- 요청 경로, 쿼리, 페이지 번호와 페이지 크기
- 제목, 작품 상대 URL, 표지 URL, 상태 필드
- 다음 페이지 존재 여부를 판단하는 근거
- 빈 결과와 마지막 페이지의 응답 형태
- Legacy와 Next에서 작품 ID가 같은지
- 절대 URL이 섞일 경우 상대 URL로 바꾸는 규칙
- Legacy와 Next가 제공하는 필터 항목, 표시 이름과 내부 값
- 각 필터가 단일 선택인지 다중 선택인지
- 필터 기본값, 전체 선택과 초기화 동작
- 필터 조합 시 요청 파라미터, 인코딩과 페이지 초기화 규칙
- 인기·최신 정렬과 사용자가 고른 필터가 함께 적용되는 방식
- 같은 이름의 필터라도 Legacy와 Next에서 값 체계가 다른지

검증 표본:

- 첫 페이지
- 중간 페이지
- 마지막 페이지 또는 빈 페이지
- 한글 검색 결과 있음
- 검색 결과 없음
- 종료작 또는 휴재작이 포함된 결과
- 필터를 하나씩 적용한 결과
- 서로 다른 필터 두 개 이상을 조합한 결과
- 제목 검색과 필터를 함께 적용한 결과
- 필터 초기화 후 기본 목록으로 복귀
- Legacy에만 있거나 Next에만 있는 필터

### 기능 B: 작품 상세 및 에피소드 목록

확인 항목:

- 제목, 표지, 설명, 작가, 장르, 상태 선택자
- 작품 ID를 얻는 위치
- 회차 제목, 상대 URL, 날짜와 순서
- 초기 HTML에 노출되는 회차 수
- 101개를 초과한 이전 회차를 불러오는 방법
- 유료·광고·로그인 표시가 회차 데이터에 미치는 영향
- 회차가 없는 작품과 일부 메타데이터가 없는 작품의 형태
- Mangayomi가 요구하는 최신순 또는 원래 순서와 클라이언트의 순서 보존 기능 연결

검증 표본:

- 일반 작품
- 101회 이하 작품
- 101회 초과 장편 작품
- 설명 또는 작가가 없는 작품
- 회차 날짜가 없거나 형식이 다른 작품
- Legacy와 Next 양쪽에 존재하는 동일 작품 ID

### 기능 C: 에피소드 상세 및 이미지 목록

확인 항목:

- 리더 HTML에 이미지 주소가 직접 있는지
- bootstrap JSON 또는 스크립트에서 얻어야 하는 필드
- 이미지 API 경로와 요청 방식
- 이미지 토큰 및 HMAC proof가 현재도 필요한지
- `ad_ack_required` 발생 조건과 정상 사용 흐름
- Cookie, User-Agent, Referer 등 필수 헤더
- 이미지 배열의 문자열/객체 형태
- 이미지 순서와 중복 제거 기준
- 만료 토큰, 403, 404, 빈 payload 처리
- Cloudflare 해결 후 재시도 시 원래 요청 정보가 보존되는지

검증 표본:

- Legacy 일반 회차
- Next 일반 회차
- 광고 확인이 필요한 회차
- 이미지 수가 적은 회차와 많은 회차
- 첫 이미지, 중간 이미지, 마지막 이미지 실제 로딩
- iPhone과 Android 패드에서 같은 회차 로딩

## 7. 조사 산출물

각 기능을 조사할 때 다음 자료만 남긴다. 민감한 Cookie 값이나 세션 값은 저장하지 않는다.

- 수집 일시와 사용한 수집 방식: 일반 HTTP 또는 브라우저
- 요청한 도메인과 상대 경로
- 리다이렉트 후 최종 URL
- HTTP 상태와 `Content-Type`
- 응답에서 직접 확인한 Legacy 또는 Next 판정 근거
- 요청 계약: 메서드, 상대 경로, 쿼리 이름, 필요한 헤더 이름
- 응답 계약: 필요한 필드와 선택자
- Legacy 표본과 Next 표본을 분리한 최소 fixture
- 정상, 빈 결과, 구조 변경, 인증 실패 사례
- 확인된 사실과 아직 추정인 내용을 분리한 기록
- 과거 구현과 현재 사이트의 차이

조사 순서는 현재 응답 직접 수집 → 현재 계약 작성 → 최소 fixture 작성 → 과거 자료와 차이 비교로 고정한다. 실제 HTML 전체를 테스트 fixture로 복사하기보다 현재 응답에서 필요한 구조만 최소화한다. 사용자가 제공한 `resource/` 파일은 현재 계약 작성에 사용하지 않으며, 나중에 비교가 필요하면 읽기 전에 범위를 알리고 원본은 수정하지 않는다.

## 8. Webtoon 설계 게이트

조사가 끝나면 구현 전에 다음 결정을 사용자에게 하나씩 확인받는다. 목록 범위는 이미 확정됐다.

1. **확정:** 인기, 최신, 제목 검색과 전체 필터를 첫 버전에 포함한다.
2. 조사로 확인한 Legacy와 Next의 필터 목록 및 표현 방식을 승인할지
3. 기본 Source 프로필
4. Custom 주소 구조 판별 실패 시 동작
5. 101회 초과 회차를 첫 버전에서 완전 지원할지
6. 광고 확인이 필요한 회차의 사용자 흐름
7. Legacy와 Next 중 어느 쪽을 먼저 구현·검증할지
8. 테스트 fixture 저장 범위
9. JavaScript 확장으로 계속 갈지, Dart와 비교할지
10. 조사 시점의 Mangayomi upstream 및 수정 클라이언트 기준 커밋

위 결정이 끝나야 Webtoon 설계 문서를 작성한다. 설계 문서를 사용자에게 검토받은 다음에만 파일별 구현 계획을 작성한다.

## 9. Webtoon 구현 예정 순서

아직 구현 승인을 의미하지 않는다. 각 단계는 별도 설명, 승인, 실패 테스트, 최소 구현, 검증 순서로 진행한다.

1. 확장 저장소 최소 구조와 Webtoon Source 등록
2. Source 프로필 설정과 상대 URL 처리
3. Legacy 작품 목록
4. Next 작품 목록
5. 제목 검색, 전체 필터 및 페이지 처리
6. Legacy 작품 상세와 회차 목록
7. Next 작품 상세와 회차 목록
8. 101회 초과 회차 처리
9. Legacy 회차 이미지
10. Next 회차 이미지와 proof 흐름
11. Cloudflare WebView 재시도 연결
12. iPhone 및 Android 패드 실기기 검증
13. Webtoon 회귀 테스트와 완료 승인

각 단계는 앞 단계의 테스트가 통과해야 시작한다. Legacy와 Next 구현은 같은 인터페이스를 사용할 수 있지만 선택자와 응답 파싱 함수는 공유하지 않는다.

## 10. Webtoon 완료 기준

- 선택한 모든 Source 프로필에서 작품 목록을 열 수 있다.
- 제목 검색의 결과 있음과 없음이 동작한다.
- 각 Source 계열이 제공하는 전체 필터를 단독 및 조합으로 적용할 수 있다.
- 제목 검색과 필터를 함께 적용하고 초기화할 수 있다.
- 작품 상세와 전체 회차 목록을 볼 수 있다.
- 회차 순서가 사이트 및 Mangayomi 표시 규칙과 일치한다.
- 첫·중간·마지막 이미지가 실제로 로딩된다.
- 주소 변경 시 파서 코드를 수정하지 않고 Source 설정으로 대응할 수 있다.
- 한 프로필의 실패가 다른 프로필의 파서로 조용히 넘어가지 않는다.
- 403, 구조 불일치, 빈 결과가 서로 구분되는 오류로 남는다.
- iPhone과 Android 패드에서 최소 한 작품을 끝까지 열어본다.
- Webtoon 테스트 통과 후 사용자에게 Manhwa 단계 진입 승인을 받는다.

## 11. 후속 계층 진행 방식

### Manhwa

Webtoon 코드를 복사하거나 공통 파서로 승격하지 않는다. Manhwa의 목록, 상세, 회차, 이미지 구조를 다시 조사하고 별도 설계·계획·승인 절차를 밟는다.

### Novel

목록, 상세, 회차까지도 별도 파서를 사용한다. 본문은 이미지 리더와 분리해 텍스트 정리, 문단, HTML 허용 범위와 인코딩을 새로 검증한다.

### Anime

가장 마지막에 진행한다. 목록, 상세, 에피소드, 플레이어 소스와 필수 헤더를 별도로 조사하며 `/anime` 및 `/anime/{id}` 형식은 현재 후보 계약으로만 기록한다.

## 12. Git 체크포인트

현재 작업공간은 기존 GitHub 저장소 `gilsek/ntk-mangayomi`를 `origin`으로 사용한다.

- 원격 기본 브랜치: `master`
- 작업 기준 커밋: `b3d79a28568f4563e39409a1b49b2f3e1848d861`
- 현재 작업 브랜치: `codex/webtoon-rebuild`
- 브랜치 기준: `origin/master`
- 기존 원격 이력과 현재 미추적 파일의 정확한 경로 충돌: 0건

원격 이력을 체크아웃하면서 과거 `ntk.js`, 테스트와 설계 문서가 작업공간에 존재하지만, 현재 사이트 계약이 완성되기 전에는 해당 구현을 조사 입력으로 읽거나 수정·재사용하지 않는다. 구현 단계에서는 사용자가 승인한 기능 경계 안에서 현재 계약을 기준으로 교체 범위를 결정한다.

사용자 파일인 `resource/`는 계속 미추적 상태로 유지하며 임의로 스테이징하지 않는다. 새 로드맵도 사용자 검토와 커밋 승인을 받기 전에는 스테이징하지 않는다.

커밋은 자동으로 만들지 않고 다음 경계에서 사용자에게 제안한다.

1. 조사·설계 문서 확정
2. Webtoon Source 및 설정 등록 검증
3. 작품 목록 검증
4. 작품 상세와 회차 목록 검증
5. 회차 이미지 검증
6. Webtoon 실기기 및 회귀 검증
7. Manhwa, Novel, Anime의 각 독립 완료 지점

## 13. 바로 다음 단계

다음 작업은 코딩이 아니라 **Webtoon 작품 목록과 전체 필터의 현재 계약 검증**이다.

1. **완료:** 첫 버전 범위를 인기, 최신, 제목 검색과 전체 필터로 확정한다.
2. **완료:** Mangayomi upstream, 공식 확장 저장소 및 수정 클라이언트 기준 커밋을 기록한다.
3. **완료:** Legacy `newtoki1.org`의 현재 작품 목록·검색·필터 요청을 현재 공개 응답에서 직접 추출한다.
4. **완료(승인):** 현재 응답만으로 Legacy 작품 목록 계약과 최소 fixture 후보를 작성하고 사용자 승인을 받는다.
5. Next `sbxh9.com`의 작품 목록·검색·필터 요청을 현재 공개 응답에서 직접 추출한다.
6. 현재 응답만으로 Next 작품 목록 계약과 최소 fixture 후보를 작성한다.
7. 현재 계약 작성이 끝난 뒤에만 과거 GitHub 구현 및 저장 HTML과 차이를 비교한다.
8. 각 계열의 필터 항목, 값, 조합, 초기화와 페이지 초기화 규칙을 표로 정리한다.
9. `toki30.com`은 WebView로 접근 가능한 자료가 준비될 때 Next 계약과 같은지 별도 확인한다.
10. 결과를 사실/추정/불일치로 나눠 기록하고 작품 목록 설계를 사용자에게 제시한다.

## 14. 2026-07-13 Legacy Webtoon 직접 추출 체크포인트

### 수집 정보

- 수집 일시: `2026-07-13 06:10~06:12 KST`
- 요청 도메인: `newtoki1.org`
- 수집 방식: 일반 HTTP, iPhone Safari User-Agent
- 요청 경로: `/webtoon`
- 최종 URL: 기본 목록은 `/webtoon`
- 상태: `200`
- 응답 형식: `text/html; charset=utf-8`
- 응답 크기: 기본 목록 약 420 KB
- 서버 렌더링 HTML 안에 작품 목록과 필터 폼이 함께 포함된다.
- 이번 추출에서는 과거 API 경로, 과거 선택자 또는 `resource/` 저장 HTML을 사용하지 않았다.

### 현재 목록 구조에서 직접 확인한 사실

- 목록 컨테이너: `#webtoon-list-all`
- 작품 행: 목록 컨테이너의 `li`
- 작품 상대 경로: `/webtoon/{opaqueWorkKey}`
- 작품 제목: 작품 행 안의 `span.title.white`
- 표지: 작품 행 안의 `img.theme-thumb-img`
- 플랫폼 표시: `div.list-platform`의 `title`
- 갱신일 표시: `div.list-date`
- 작품 행에는 `data-weekday`, `data-initial`, `data-genre` 속성이 있다.
- `opaqueWorkKey`는 숫자로 한정되지 않는다. 첫 페이지에서 숫자 경로 94개와 slug 경로 2개를 직접 확인했다.
- 따라서 작품 ID를 정수로 변환하지 않고 상대 경로 전체를 불투명 식별자로 보관해야 한다.

### 페이지 검증

- 1페이지: 작품 96개, URL 중복 0, 제목 누락 0, URL 누락 0, 표지 누락 0
- 2페이지: 작품 96개, URL 중복 0, 제목 누락 0, URL 누락 0, 표지 누락 0
- 80페이지: 작품 31개, URL 중복 0, 제목 누락 0, URL 누락 0, 표지 누락 1
- 기본 페이지의 마지막 페이지 링크는 `page=80`이었다.
- 표지가 누락된 작품도 정상 목록 항목으로 유지할 수 있어야 한다.

### 현재 폼에서 직접 확인한 요청 필드

- 고정 또는 기본 필드: `kind=webtoon`, `pub=ongoing`, `sst=as_update`, `sod=desc`
- 제목 검색: `stx`
- 작가 검색: `author`
- 분류: `toon`
- 요일: `yoil`
- 초성: `jaum`
- 플랫폼: `plat`
- 장르: `tag`
- 정렬: `sst`, `sod`
- 페이지: `page`

현재 UI에 노출된 정렬 값은 `as_update`, `as_new`, `as_bookmark`, `as_view`, `as_rating`, `as_episode`다. 요일, 초성, 플랫폼과 장르의 정확한 표시 이름 및 내부 값도 현재 폼에서 추출했으며, 다음 계약 작성 단계에서 계열별 표로 정리한다.

### 현재 요청 동작에서 직접 확인한 사실

- 조회순 요청은 `sst=as_view&sod=desc`로 목록 순서를 변경했다.
- `stx=백수세끼` 제목 검색은 해당 작품 1개를 반환했다.
- `yoil=월`과 `tag=로맨스`는 각각 필터링된 목록과 별도 페이지 수를 반환했다.
- 일반 쿼리 URL은 서버에서 `302`로 `/webtoon/__q/{encodedQuery}` 형태로 이동한다.
- 확장에서는 현재 폼의 일반 쿼리를 요청하고 리다이렉트를 따르는 방향을 우선 검토한다. `/__q/` 인코딩 형식을 직접 생성하는 구현은 현재 범위에 넣지 않는다.

### 계약 초안까지 추가 확인한 항목

- 전체 필터 표시값과 내부값
- 복수 필터 조합과 제목 검색 동시 적용
- 작가 검색과 성인, BL/GL, 완결 분류 결과
- 빈 검색 결과와 필터 마지막 페이지
- 표지 누락 항목의 fallback HTML
- iPhone과 Android 태블릿 User-Agent 응답 일치
- 페이지 묶음 화살표를 제외한 `hasNextPage` 판정 기준

### 승인된 계약 결정

- `getPopular`은 조회순 `as_view`로 매핑한다.
- 웹 UI 기준에 맞춰 한 글자 제목 검색은 요청하지 않는다.
- 작가는 `TextFilter`, 나머지 전체 필터는 `SelectFilter`로 제공한다.
- 성인웹툰이 주요 사용 목적이므로 Webtoon Source는 `isNsfw: true`로 등록한다.
- `pub=ongoing`은 현재 사이트가 폼에 제공한 고정 파라미터로 취급하고 내부 의미를 추측하지 않는다.
- 표지 누락 작품은 빈 `imageUrl`로 유지한다.
- 현재 페이지와 페이지 링크 최대값을 비교해 `hasNextPage`를 결정한다.
- 신규 Webtoon Source ID `260713001`을 사용한다.

Legacy 작품 목록 계약은 `docs/research/2026-07-13-newtoki1-webtoon-list-contract.md`에 저장했고 2026-07-13 사용자 승인을 받았다. 다음 단계는 승인된 범위로 Webtoon 작품 목록의 상세 구현 계획을 작성하는 것이다. 과거 구현은 계획 입력으로 사용하지 않는다.

2026-07-13 후속 체크포인트에서 신규 ID `260713001`의 Legacy Webtoon 목록·검색·전체 필터·페이지 판정과 클라이언트 테스트용 `index.json` 엔트리를 구현했다. Webtoon 전용 21개와 저장소 전체 59개 테스트가 통과했고, iPhone 및 Android 태블릿 UA 라이브 응답도 일치했다. Git 게시와 사용자 클라이언트 검증은 아직 진행하지 않았다. 작품 상세·회차·이미지는 다음 별도 계약 단계다.

## 15. 확장 저장소 패키징 및 버전 정책

### 저장소 구조

GitHub 저장소와 `index.json`은 하나를 유지하되 네 Source의 구현과 테스트를 완전히 분리한다.

```text
javascript/manga/src/ko/ntk_webtoon.js
javascript/manga/src/ko/ntk_manhwa.js
javascript/novel/src/ko/ntk_novel.js
javascript/anime/src/ko/ntk_anime.js
tests/webtoon/
tests/manhwa/
tests/novel/
tests/anime/
```

- 각 구현 파일은 하나의 Source와 하나의 `DefaultExtension`만 담당한다.
- `additionalParams`로 콘텐츠 계층을 분기하지 않는다.
- 목록, 검색, 필터, 상세, 회차, 이미지, 본문과 영상 파서를 계층 사이에 공유하지 않는다.
- 초기 구현에서는 URL 보조 함수나 요청 보조 함수도 각 파일에 독립적으로 둔다.
- 현재 `javascript/manga/src/ko/ntk.js`는 단계적 전환 중 과거 Source를 유지하는 용도로만 남긴다.
- 네 신규 Source가 모두 독립 파일로 전환되고 어떤 `index.json` 엔트리도 과거 파일을 참조하지 않을 때 삭제 승인을 요청한다.

### 신규 Source ID

과거 Source ID와 설치 상태, 캐시, 라이브러리 URL을 승계하지 않는다. 다음 신규 ID를 사용한다.

- NTK Webtoon: `260713001`
- NTK Manhwa: `260713002`
- NTK Novel: `260713003`
- NTK Anime: `260713004`

기존 `240710001`, `240710002`, `240710003`은 신규 Source에서 재사용하지 않는다. 기존 Source는 새 엔트리와 자동으로 연결하거나 자동 마이그레이션하지 않으며, 필요할 경우 Mangayomi에서 obsolete 상태로 남긴 뒤 사용자가 직접 새 Source로 전환한다.

### `index.json` 분류

- Webtoon: `itemType: 0`
- Manhwa: `itemType: 0`
- Anime: `itemType: 1`
- Novel: `itemType: 2`

동일한 `index.json` URL을 Mangayomi의 Manga, Novel, Anime 저장소 설정에 등록하고 Mangayomi의 `itemType` 필터링을 사용한다. 각 엔트리의 `sourceCodeUrl`은 자기 전용 JavaScript 파일만 가리킨다.

### 버전 정책

Mangayomi의 버전 비교가 점으로 구분된 각 값을 숫자로 처리하므로 모든 Source 버전은 숫자형 `major.minor.patch`만 사용한다. `alpha`, `beta`, 날짜나 임의 문자열을 버전 필드에 넣지 않는다.

- `0.1.x`: Webtoon Source 프로토타입 개발과 검증
- `0.2.x`: Manhwa Source 프로토타입 추가와 검증
- `0.3.x`: Novel Source 프로토타입 추가와 검증
- `0.4.x`: Anime Source 프로토타입 추가 및 네 Source 통합 안정화
- `0.5.0`: Webtoon, Manhwa, Novel, Anime의 첫 프로토타입이 모두 각 완료 기준을 통과한 통합 마일스톤

각 Source 파일이 변경될 때 해당 Source의 patch 버전을 올린다. 단계가 바뀌었다는 이유만으로 변경되지 않은 Source의 버전을 불필요하게 올리지는 않지만, `0.5.0` 통합 마일스톤을 배포할 때는 네 Source의 버전을 모두 `0.5.0`으로 맞춘다. 이후 수정은 `0.5.1`, `0.5.2`처럼 patch 버전부터 진행한다.

### 단계적 등록 순서

1. 신규 Webtoon ID와 `ntk_webtoon.js`를 전용 테스트와 함께 준비한다.
2. Webtoon 검증 후 `index.json`에 신규 Webtoon 엔트리를 등록하고 과거 Webtoon 엔트리를 제거한다.
3. 같은 절차로 Manhwa와 Novel을 각각 독립 파일 및 신규 ID로 전환한다.
4. 마지막으로 Anime 신규 엔트리를 등록한다.
5. 네 Source가 완료 기준을 통과하면 모두 `0.5.0`으로 맞추고 첫 통합 프로토타입을 배포한다.
6. 과거 `ntk.js`를 참조하는 엔트리가 없음을 검증한 뒤 별도 승인을 받아 과거 파일과 해당 테스트의 정리 여부를 결정한다.
