# Next Manhwa Reader Design

## Goal

NTK Manhwa 0.206이 생성하는 Next 회차 URL을 Mangayomi 네이티브 이미지 리더에서 열 수 있게 한다. 이 작업은 현재 수정 클라이언트가 이미 제공하는 WebView 응답 보존 기능만 사용하며 추가 클라이언트 변경은 요구하지 않는다.

## Observed Site Contract

- 회차 경로는 `/manhwa/{sourceWorkId}/{sourceEpisodeId}`이다.
- 회차 HTML은 이미지 URL 대신 `imageMetas`와 만료 가능한 `imagesToken`을 제공한다.
- 실제 이미지는 브라우저가 `POST /api/manhwa-images`로 요청한다.
- 요청에는 브라우저 세션 HMAC, Manhwa 브라우저 키 서명, 광고 확인 상태가 필요하다.
- 따라서 확장 `Client`에서 이 요청을 재구현하지 않고 사이트의 정상 WebView 실행에 맡겨야 한다.

## Architecture

`ntk_manhwa.js` 안에 독립 `MANHWA_READER_METHODS` 계층을 둔다. `getPageList()`는 안전하게 정규화한 회차 URL을 숨겨진 WebView로 열고, 문서에 주입된 Manhwa 전용 추출기가 `/api/manhwa-images` 성공 응답을 복제해 이미지 URL을 수집한다. API 가로채기가 늦었을 때는 `.vw-imgs .viewer-lazy-img`가 전부 준비될 때까지 짧게 폴링하는 DOM 대체 경로를 사용한다.

Webtoon 구현과 코드를 공용화하지 않는다. 두 계층은 사이트 변화와 인증 실패를 독립적으로 진단할 수 있어야 한다.

## Data Flow

1. `normalizeChapterLink()`가 입력을 `/manhwa/{work}/{episode}`로 정규화한다.
2. `evaluateJavascriptViaWebview()`가 현재 Next base URL과 같은 회차 페이지를 연다.
3. 추출기가 현재 경로 일치를 확인하고 광고 확인 이벤트를 알린 뒤 `window.fetch`를 감싼다.
4. `/api/manhwa-images` 응답에서 유효한 절대 HTTP(S) 이미지 URL을 원래 순서로 수집하고 중복을 제거한다.
5. API 결과가 없으면 완성된 뷰어 DOM에서 같은 규칙으로 수집한다.
6. 확장은 각 URL을 `{ url, headers }` 페이지 객체로 반환한다.

## Failure and Safety Rules

- 잘못된 회차 URL은 네트워크·WebView 요청 전에 거부한다.
- 외부 origin, 쿼리, fragment, 추가 path segment를 허용하지 않는다.
- WebView 거부, 잘못된 JSON, 빈 이미지 목록은 기능·파서 계열·정규화된 경로만 포함한 오류로 바꾼다.
- 토큰, 세션, 원본 악성 URL은 오류 메시지에 포함하지 않는다.
- 광고·플랫폼·본문 외 이미지는 뷰어 API 또는 뷰어 컨테이너 밖에서 수집하지 않는다.

## Compatibility and Performance

- 기존 수정 클라이언트의 `evaluateJavascriptViaWebview`와 `setResponse` payload 보존 패치를 그대로 사용한다.
- API 성공 응답을 DOM보다 먼저 반환해 첫 이미지 목록 확보 시간을 줄인다.
- 이미지 자체는 Mangayomi가 URL별로 로드하므로 `getPageList()`가 이미지 바이트를 선다운로드하지 않는다.
- 기존 Popular, Latest, 검색, 필터, 상세, 회차 목록 동작에는 손대지 않는다.

## Version and Validation

- NTK Manhwa 버전은 `0.207`로 올린다.
- 전용 단위 테스트에서 URL, 헤더 재사용, API 빠른 경로, DOM 대체 경로, 안전한 오류를 검증한다.
- Manhwa 전체 테스트와 저장소 전체 테스트, JavaScript 문법 검사, `git diff --check`를 통과시킨다.
- 배포 후 Windows와 iPhone에서 실제 회차의 첫 로딩과 후속 이미지 표시를 확인한다.
