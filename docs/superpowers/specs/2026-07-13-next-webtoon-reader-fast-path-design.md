# Next Webtoon Reader Fast Path Design

## 목표

NTK Webtoon `0.109`에서 회차를 열 때 사이트 리더 DOM 전체가 완성될 때까지 기다리지 않고 `/api/webtoon-images` 응답의 이미지 URL을 즉시 Mangayomi에 전달한다. 실제 이미지 파일은 기존과 같이 Mangayomi 리더가 페이지별로 요청한다.

## 확인된 현재 동작

- Mangayomi `getPageList()`는 전체 `PageUrl` 배열을 받은 뒤 현재 위치 주변의 이미지만 개별적으로 선행 로딩한다.
- 현재 확장은 Headless WebView에서 `.vw-imgs`의 모든 `.viewer-lazy-img`에 URL이 생길 때까지 200ms 간격으로 확인한다.
- 사이트 리더는 `window.__ntk_ad_ack_scope`가 현재 회차 경로와 일치하지 않으면 `ntk-ad-ack-ready` 이벤트를 기다린다.
- 준비가 끝나면 `POST /api/webtoon-images`를 호출하고 `images[].src`를 DOM의 `data-src`로 사용한다.
- 첨부된 Mihon/Tachiyomi NTK 1.4.3 확장도 같은 이미지 API의 `fetch` 응답을 가로채 URL 목록을 추출한다.

## 검토한 접근

### 1. 기존 DOM 수집만 유지

가장 단순하고 사이트 내부 구현과 느슨하게 결합되지만 광고 확인과 React 렌더링이 모두 끝나야 하므로 시작 지연을 해결하지 못한다.

### 2. 이미지 API 응답 가로채기와 DOM fallback 병행 — 선택

문서 시작 시 `window.fetch`를 감싸고 `/api/webtoon-images` 응답 복제본을 읽는다. 유효한 `images[].src`가 확인되면 즉시 `setResponse`를 호출한다. API 형식 변경, `fetch` 부재 또는 빈 응답에서는 기존 DOM 수집을 계속 사용한다.

이 방식은 직접 proof나 세션 알고리즘을 재구현하지 않으며 사이트가 정상적으로 만든 응답만 관찰한다. Android와 iOS 모두 동일한 JavaScript를 사용하고 응답 전달만 Mangayomi의 `flutter_inappwebview` 브리지를 사용한다.

### 3. WebView 없이 이미지 API 직접 호출

가장 빠를 수 있지만 `x-nv-session`, nonce, HMAC proof, fingerprint와 토큰 만료 규약을 확장에서 복제해야 한다. 사이트 변경에 취약하고 현재 계층 분리 원칙에도 맞지 않아 제외한다.

## 데이터 흐름

1. 정확한 `/webtoon/{workId}/{episodeId}` URL을 Headless WebView로 연다.
2. 문서 시작 스크립트가 경로를 검증하고 한 번만 설치된다.
3. 현재 경로를 `window.__ntk_ad_ack_scope`에 기록하고 `ntk-ad-ack-ready`를 알린다.
4. 원본 `window.fetch`를 보존한 뒤 이미지 API 응답만 복제한다.
5. `images`의 문자열 항목 또는 객체의 `src` 중 유효한 HTTP(S) URL을 순서대로 중복 제거한다.
6. URL이 하나 이상이면 `{ok: true, images}`를 한 번만 반환한다.
7. API 빠른 경로가 성공하지 않으면 기존의 완전한 DOM 검사와 20초 제한을 유지한다.
8. `getPageList()`는 URL 배열을 `PageUrl` 객체로 바꾸며 헤더는 호출당 한 번만 계산한다.

## 오류 및 호환성

- 관련 없는 `fetch` 응답은 읽지 않는다.
- JSON 오류, 빈 이미지 배열, 유효하지 않은 URL은 WebView 전체 실패로 처리하지 않고 DOM fallback으로 넘긴다.
- `ad_ack_required` 또는 `fingerprint_required`가 관찰되면 scope를 다시 기록하고 ready 이벤트를 한 번 더 알리되, 사이트 자체 재시도 횟수는 변경하지 않는다.
- `respond()`의 단일 완료 가드로 API와 DOM 경로가 중복 응답하지 않게 한다.
- Legacy Webtoon과 Manhwa, Novel, Anime 코드는 변경하지 않는다.

## 검증 기준

- 테스트용 WebView에서 이미지 API 응답만으로 DOM 생성 전에 URL이 반환된다.
- 객체형 `images[].src`와 문자열형 이미지 URL을 모두 처리한다.
- 관련 없는 API, 잘못된 JSON과 빈 응답은 기존 DOM fallback을 유지한다.
- 광고 확인 scope와 이벤트가 현재 회차 경로로 설정된다.
- 기존 DOM 완전성, 오류, 타임아웃 테스트가 그대로 통과한다.
- `index.json`과 내장 메타데이터가 모두 `0.109`이며 전체 테스트가 통과한다.
