// ☕ 찻집 · 🖼️ 전시장에서 쓰는 데이터 (여기만 고치면 내용이 바뀌어요)

export const cafeData = {
  // 벽의 메뉴판을 누르면 보이는 메뉴
  menu: [
    { emoji: "☕", name: "따뜻한 아메리카노", description: "오늘의 원두로 내린 기본 커피예요." },
    { emoji: "🍵", name: "유자차", description: "새콤달콤한 유자청을 듬뿍 넣었어요." },
    { emoji: "🍫", name: "핫초코", description: "추운 날엔 역시 진한 초콜릿!" },
    { emoji: "🥛", name: "꿀 우유", description: "자기 전에 마시기 좋은 따뜻한 우유." },
    { emoji: "🍰", name: "딸기 케이크", description: "생크림 위에 딸기를 잔뜩 올렸어요." },
  ],
  // 메뉴판 아래 한 줄 인사
  note: "천천히 쉬다 가세요. 위쪽 문은 🛋️ 거실, 오른쪽 문은 🖼️ 전시장이에요.",
};

export const galleryData = {
  title: "겨울밤 작은 전시회",
  intro: "호스트가 고른 올해의 장면들이에요. 작품 가까이 가서 살펴보세요.",
  // 작품 (앞의 5개는 벽에, 나머지 3개까지는 이젤에 걸려요 — 최대 8개)
  //  image: public/gallery 폴더에 그림을 넣고 "/gallery/파일이름.png" 로 적어요 (비워 두면 임시 그림)
  artworks: [
    { id: "art1", title: "첫눈 오는 골목", artist: "호스트", year: "2026", image: "", description: "올해 첫눈이 내리던 날, 집 앞 골목에서." },
    { id: "art2", title: "따뜻한 창가", artist: "호스트", year: "2026", image: "", description: "창가에 앉아 차를 마시던 오후." },
    { id: "art3", title: "우리의 여름", artist: "호스트", year: "2026", image: "", description: "바다에 다녀온 날의 기억." },
    { id: "art4", title: "밤의 산책", artist: "호스트", year: "2026", image: "", description: "가로등 아래를 천천히 걷던 밤." },
    { id: "art5", title: "작은 화분", artist: "호스트", year: "2026", image: "", description: "책상 위에서 꿋꿋하게 자란 친구." },
    { id: "art6", title: "기차 여행", artist: "호스트", year: "2026", image: "", description: "창밖 풍경이 그림 같던 하루." },
  ],
};
