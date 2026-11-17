// ☕ 군산 온라인 찻집 · 🖼️ 전시회에서 쓰는 데이터 (여기만 고치면 내용이 바뀌어요)

import { partyData } from "./data";

export const cafeData = {
  // 차림표 메뉴는 data.js의 teaMenu에 있어요 (사장님 메뉴 상태·투표·피드백이 메뉴 id로 저장돼요)
  menu: partyData?.teaMenu?.items ?? [],
  // 메뉴판 아래 한 줄 인사
  note: "천천히 쉬다 가세요. 위쪽 통로는 🛋️ 거실, 왼쪽·오른쪽 아래 통로는 🖼️ 전시회예요.",
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
};
