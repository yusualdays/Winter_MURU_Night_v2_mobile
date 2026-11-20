// ☕ 군산 온라인 찻집 · 🖼️ 전시회에서 쓰는 데이터 (여기만 고치면 내용이 바뀌어요)

import { partyData } from "./data";

export const cafeData = {
  // 차림표 메뉴는 data.js의 teaMenu에 있어요 (사장님 메뉴 상태·투표·피드백이 메뉴 id로 저장돼요)
  menu: partyData?.teaMenu?.items ?? [],
  // 메뉴판 아래 한 줄 인사
  note: "천천히 쉬다 가세요. 위쪽 통로는 🛋️ 거실, 카운터와 다구 선반 사이 길은 🖼️ 전시회, 오른쪽 아래 통로는 🌳 무해림이에요.",
};

export const galleryData = {
  title: "겨울밤 작은 전시회",
  intro: "호스트가 고른 올해의 장면들이에요. 작품 가까이 가서 살펴보세요.",
  // 작품 (앞의 4개는 벽 액자에, 5·6번째는 유리 진열장에 — 최대 6개)
  //  image: public/gallery 폴더에 그림을 넣고 "/gallery/파일이름.png" 로 적어요 (비워 두면 배경 그림에 그려진 작품이 그대로 보여요)
  artworks: [
    { id: "art1", title: "첫눈 오는 골목", artist: "호스트", year: "2026", image: "", description: "올해 첫눈이 내리던 날, 집 앞 골목에서." },
    { id: "art2", title: "따뜻한 창가", artist: "호스트", year: "2026", image: "", description: "창가에 앉아 차를 마시던 오후." },
    { id: "art3", title: "우리의 여름", artist: "호스트", year: "2026", image: "", description: "바다에 다녀온 날의 기억." },
    { id: "art4", title: "밤의 산책", artist: "호스트", year: "2026", image: "", description: "가로등 아래를 천천히 걷던 밤." },
    { id: "art5", title: "작은 화분", artist: "호스트", year: "2026", image: "", description: "책상 위에서 꿋꿋하게 자란 친구." },
    { id: "art6", title: "기차 여행", artist: "호스트", year: "2026", image: "", description: "창밖 풍경이 그림 같던 하루." },
  ],
  // 📜 전시 안내문 (입구 옆 안내판) — 처음 온 손님에게 "!"가 떠요
  guide: {
    title: "추후 작성 예정", // 전시 제목
    theme: "추후 작성 예정", // 전시의 주제 (여러 줄 가능)
    // 전시 관람 순서
    steps: [
      { icon: "🎧", title: "청음실에서 음악 틀기", desc: "아래 가운데 청음실 앞에 서서 [🎧 음악 듣기] → LP를 골라 주세요. 둘러보는 동안 계속 흘러나와요." },
      { icon: "🖼️", title: "작품 자유롭게 둘러보기", desc: "작품 가까이 가면 이름 버튼이 떠요. 누르면 크게 보고 설명을 읽을 수 있어요. 가운데 벤치에 앉아 쉬어 가도 좋아요." },
      { icon: "📖", title: "방명록 적기", desc: "왼쪽 아래 책상에서 감상 한 마디와 가장 마음에 든 작품을 남겨 주세요." },
    ],
  },
  // 🎧 청음실 (아래 가운데 LP 플레이어) — url에 유튜브 "재생목록" 또는 "영상" 링크를 붙여 넣어요
  //  예) "https://www.youtube.com/playlist?list=PLxxxxxxxx"  /  "https://youtu.be/xxxxxxxxxxx"
  //  url이 비어 있으면 "링크 준비 중"으로 보여요. 손님이 직접 링크를 넣어 들을 수도 있어요
  //  color: 음반 표지 색
  listening: {
    playlists: [
      { id: "lp1", title: "겨울밤 재즈", desc: "눈 오는 밤의 피아노 트리오", color: "#1e3a5f", url: "" },
      { id: "lp2", title: "따뜻한 로파이", desc: "작품 보며 듣기 좋은 잔잔한 비트", color: "#7f1d1d", url: "" },
      { id: "lp3", title: "클래식 소품", desc: "전시회의 기본, 고요한 클래식", color: "#14532d", url: "" },
      { id: "lp4", title: "주인장의 올해 노래", desc: "호스트가 올해 가장 많이 들은 곡들", color: "#a16207", url: "" },
    ],
  },
};

// 🌳 무해림(無害林) — 찻집 오른쪽 아래 통로, 옆으로 걷는 숲길 기획전 (app/forest/page.js)
//  손님이 자유롭게 한 마디(고민·축하·하고 싶은 말·오늘의 기분)를 쓰고, 그 팻말이 달린 나무를 숲길에 심어요
//  Firebase: forest/trees/{id} = 손님 나무 · forest/host = 주인장 나무 팻말 · forestSecrets/{id} = 비밀 나무 내용 (관리자만 읽기)
export const forestData = {
  // 입구 나무 팻말
  entranceTitle: "無害林",
  entranceReading: "없을 무 · 해할 해 · 수풀 림",
  // 주인장 대사
  greeting: "어서 오세요.",
  plantGuide: "나만의 나무를 심어보세요.",
  // 나무 심기 입력창 안내
  placeholder: "당신의 나무에 마음을 남겨보세요..",
  maxLength: 100,
  // 주인장 나무 팻말 (처음 문장) — ⚙️ 관리(사장님 모드)에서 바꿀 수 있어요
  hostSign: "무해임의 숲, 무해임",
  hostName: "무해임",
  // 🔐 관리자 계정 UID (Firebase 콘솔 → Authentication → 사용자 → 사용자 UID 복사) — 비밀 나무를 읽을 수 있는 사람
  adminUid: "",
  // 🎵 숲 배경 음악 — 음악 파일을 public/forest/ 에 넣고 파일 이름을 적어요 (없으면 음악 없이 새소리만)
  bgm: { src: "/forest/bgm.mp3", title: "For Madmen Only" },
};
