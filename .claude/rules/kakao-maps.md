---
globs:
  - "src/components/map/**"
  - "src/lib/kakao/**"
  - "src/app/(main)/map/**"
alwaysApply: false
---

# Kakao Maps 패턴

## SDK 로딩
- Kakao Maps SDK는 `KakaoMapProvider` 컨텍스트 안에서만 사용.
- Script 로딩은 next/script의 `afterInteractive` 전략.
- window.kakao 접근 전 반드시 로딩 완료 확인.

## 지도 컴포넌트
- 지도 컨테이너는 항상 100% 너비, 고정 높이.
- 마커 선택 상태: violet-600, 미선택: gray-400.
- 반경 오버레이: 반투명 violet-100 fill, violet-300 stroke.

## 장소 검색
- Kakao Local API의 키워드 검색 사용.
- 카테고리 코드: FD6(음식점), CE7(카페), SW8(지하철).
- 결과는 거리순 정렬, 최대 15개.

## 공유
- Kakao Share API로 장소 정보 전송.
- 공유 템플릿에 장소명, 주소, 지도 링크 포함.
