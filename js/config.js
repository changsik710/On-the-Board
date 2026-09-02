/* ============================================================
   On the B.O.A.R.D  ·  설정 파일
   이 파일 두 줄만 본인 값으로 바꾸면 앱이 동작합니다.
   Supabase 대시보드 > Project Settings > API 에서 복사하세요.
   주의: service_role 키는 절대 넣지 마세요. anon public 키만 사용합니다.
   ============================================================ */
const CONFIG = {
  SUPABASE_URL: "https://idmsacwhldrfpofbiprp.supabase.co/",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkbXNhY3dobGRyZnBvZmJpcHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyODcyMDAsImV4cCI6MjEwMzg2MzIwMH0.DlQIi4b0IRfiiQxYdnnxrv0zRHagTLos8a6U3o8jdPo",

  BUCKET: "dive-videos",          // Storage 버킷 이름
  MAX_UPLOAD_MB: 200,             // 파일 업로드 최대 용량(MB)
  TEAM_NAME: "서울체육중학교 다이빙부"
};
