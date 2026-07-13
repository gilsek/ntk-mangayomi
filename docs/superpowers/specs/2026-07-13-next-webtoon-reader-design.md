# Next Webtoon 회차 이미지 설계

## 1. 목표

NTK Webtoon `0.107`에서 Next 계열 회차를 Mangayomi 기본 세로 스크롤 리더로 읽을 수 있게 한다. 작품 목록, 검색, 필터, 상세 및 회차 목록의 기존 동작은 유지한다.

속도를 주요 완료 기준으로 둔다. 수정 Mangayomi 클라이언트의 동적 WebView URL과 payload 보존 기능을 사용해 회차 URL을 직접 열고, 불필요한 중간 페이지 이동과 고정 대기 시간을 두지 않는다.

## 2. 확인된 현재 사이트 계약

회차 URL 형식은 `/webtoon/{sourceWorkId}/{sourceEpisodeId}`다.

회차 HTML의 Next 서버 데이터에는 다음 값이 있다.

- `sourceWorkId`
- `episodeId`
- `imageMetas`
- `imagesToken`

이미지 URL은 HTML에 직접 포함되지 않는다. 사이트 리더가 광고 확인과 브라우저 세션을 준비한 뒤 `/api/webtoon-images`에 `workId`, `episodeId`, `token`, `nonce`, `proof`를 보내며, `x-nv-session` 헤더도 사용한다. 성공 응답의 `images` 항목은 `page`, `src`, `srcCandidates`, `width`, `height`를 가진다.

렌더링이 완료되면 `.vw-imgs`가 나타나고 각 페이지는 그 컨테이너의 직계 자식 하나에 대응한다. `e.src`가 있는 페이지는 컨테이너 내부의 `.viewer-lazy-img` 요소로 렌더링되며 URL은 `src`, `currentSrc` 또는 `data-src`에서 얻을 수 있다. 따라서 0보다 큰 직계 자식 수와 내부 `.viewer-lazy-img` 수가 같을 때만 전체 이미지 DOM이 준비된 것으로 판단한다.

## 3. 선택한 구조

`ntk_webtoon.js`의 Next 전용 `getPageList()`는 회차 URL을 정규화한 뒤 해당 URL을 WebView로 직접 연다. WebView 내부에서는 사이트 리더가 광고 확인, 세션 발급과 proof 생성을 담당한다.

확장에서 전달한 작은 추출 스크립트는 다음 순서로 동작한다.

1. 실행 즉시 `.vw-imgs`와 그 직계 자식 수를 확인한다.
2. 직계 자식 수가 0이거나 컨테이너 내부 `.viewer-lazy-img` 수와 다르면 짧은 간격으로 다시 확인한다.
3. 모든 직계 자식이 이미지 노드일 때 유효한 HTTP(S) URL을 `currentSrc`, `src`, `data-src` 순으로 수집한다.
4. DOM 순서를 유지하면서 빈 URL과 중복 URL을 제거한다.
5. 성공 시 `{ok: true, images: [...]}`를 `setResponse` 브리지로 한 번만 반환한다.
6. 명시적인 리더 오류나 제한 시간 초과 시 `{ok: false, error: ...}`를 반환한다.

Mangayomi 확장은 반환 payload를 검증하고 각 URL을 `{url, headers}` 페이지 객체로 변환한다.

## 4. 성능 정책

- 회차 URL을 WebView에 직접 전달하고 루트 페이지 경유와 3초 지연을 사용하지 않는다.
- 스크립트 실행 직후 DOM을 먼저 확인해 `.vw-imgs`의 0보다 큰 직계 자식 전부가 유효한 `.viewer-lazy-img`일 때 추가 대기 없이 반환한다.
- 폴링 간격은 모바일 부하를 키우지 않는 짧은 값으로 두고, 전체 제한 시간을 둔다.
- 이미지가 준비된 즉시 타이머와 관찰 작업을 정리한다.
- 확장에서 회차 HTML, 세션 API와 이미지 API를 중복 요청하지 않는다.
- 직접 세션/proof 구현과 다중 API fallback은 포함하지 않는다.

WebView 시작과 사이트 광고 확인에 걸리는 시간은 사이트 및 기기 상태에 좌우된다. 이번 구현은 확장에서 추가하는 고정 지연과 중복 네트워크 요청을 제거하는 데 초점을 둔다.

## 5. 오류 처리

다음 상황은 빈 페이지 목록으로 숨기지 않고 구분 가능한 오류로 반환한다.

- Next 형식이 아닌 회차 URL
- 수정 클라이언트에 `evaluateJavascriptViaWebview`가 없는 경우
- WebView가 비어 있거나 JSON이 아닌 payload를 반환한 경우
- `{ok: false}` 응답
- 이미지 배열 누락 또는 빈 배열
- 유효한 HTTP(S) 이미지 URL이 없는 경우
- 제한 시간 내 이미지가 준비되지 않은 경우

오류 메시지에는 `parserFamily=next`와 회차 경로를 포함하되 토큰, 쿠키와 세션 값은 넣지 않는다.

## 6. 계층 경계

- 변경 대상은 신규 Webtoon Source인 `ntk_webtoon.js`와 그 전용 테스트다.
- Legacy Webtoon 리더는 이번 범위에 포함하지 않는다.
- `ntk.js`의 과거 통합 리더 코드는 호출하거나 복사하지 않는다.
- Manhwa, Novel, Anime의 이미지·본문·영상 파서와 보조 함수를 공유하지 않는다.
- Mangayomi 클라이언트 수정은 이번 확장 커밋 범위에 포함하지 않는다.

## 7. 테스트와 검증

자동 테스트는 다음을 검증한다.

- 절대·상대 Next 회차 URL의 정규화
- WebView가 정확한 회차 URL로 직접 열림
- 즉시 DOM 확인과 제한된 폴링을 포함하는 추출 스크립트 계약
- 이미지 순서 보존
- 빈 값과 중복 URL 제거
- 문자열 및 JSON 문자열 payload 처리
- 오류 payload, 비 JSON, 빈 이미지 배열 처리
- WebView 브리지 미지원 오류
- 기존 Popular, Latest, 검색, 필터, 상세와 회차 목록 회귀 테스트
- `index.json`과 내장 manifest의 `0.107` 일치

라이브 검증은 서로 다른 페이지 수를 가진 최소 두 회차로 수행한다. 최종 사용자 검증은 수정 Mangayomi 클라이언트에서 iPhone과 Android 패드 각각 다음을 확인한다.

- 첫 이미지가 표시되는 시간
- 전체 이미지 수와 순서
- 세로 스크롤 중 이미지 누락 여부
- 회차 재진입 및 다른 회차 전환

## 8. 배포 범위

검증이 통과하면 버전을 `0.107`로 올리고 `index.json`의 메모를 Next 리더 구현 상태에 맞춘다. Webtoon 전체 완료 버전 `0.2`는 검색·필터·상세·리더의 실제 기기 검증이 끝난 뒤 별도로 결정한다.
