# 서울 숙소 주변 안전시설 지도 — Cloudflare 중계 연결 버전

## GitHub 업로드 (4개 파일)
1. GitHub `dryangban/map_test` 저장소의 `main` 브랜치를 엽니다.
2. `Add file` → `Upload files`에서 **이 폴더 안의** `index.html`, `cctv-data.json`, `police-data.json`, `bell-data.json` 네 파일을 업로드합니다. ZIP 파일 자체를 업로드하지 마세요.
3. 같은 이름 파일은 교체되며 Commit changes를 누릅니다.
4. https://dryangban.github.io/map_test/ 에서 새로고침 후 보안등 체크 → 줌 15 이상으로 확대하여 확인합니다.

## Cloudflare 설정
- 연결된 Worker: https://seoul-security-light-proxy.kupaksa.workers.dev
- Worker는 이미 배포되어 있고 `/wms` 이미지 응답을 확인했습니다. **Worker 코드를 다시 배포할 필요 없습니다.**
- 생활안전지도 API 키는 Cloudflare의 `SAFEMAP_KEY` Secret에만 있어야 합니다. GitHub에 키를 올리지 마세요.

## 출처·주의사항
- 보안등: 행정안전부 생활안전지도 WMS (공공누리 제4유형 출처표시·비상업적 이용·변경 금지).
- API 제공기관의 공개 중계·재표시 허용 조건은 별도 확인이 필요합니다.
- 보안등은 WMS 이미지이므로 개별 좌표·개수 산출은 지원하지 않습니다.
- CCTV·경찰시설·비상벨은 설치 위치 정보로서 실제 안전을 보증하지 않습니다.
- GitHub Pages 배포 환경에서 동작은 업로드 후 확인해야 합니다.
