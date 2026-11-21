// 파티에서 쓰는 데이터 모음
export const partyData = {
      hostNickname: "주인장",
  // 🗓️ 거실·전시회 오픈 기간 (이 기간에만 찻집에서 들어갈 수 있어요. 기간 밖에는 "준비중")
  //    날짜는 "연-월-일" 형식, 시작일과 마지막 날 모두 포함
  eventSchedule: { startDate: "2026-12-01", endDate: "2026-12-31" },
  // 🛍️ 쇼핑 연결 (스마트스토어 · 다식 공동구매) — 준비되면 true 로 바꿔 주세요
  //    false: 다구 쇼룸 선반 · 차림표의 [다구 쇼룸] · 미니게임 완성 화면의 [🛍️ 보러가기] 버튼이 안 보여요
  shopOpen: false,
  // 🔑 거실 입장 코드 — 찻집은 누구나, 찻집에서 🛋️ 거실로 갈 때 이 코드를 물어봐요 (비워 두면 "" 누구나)
  //    코드를 바꾸면 예전에 맞혔던 사람도 새 코드가 필요해요 (한글·영어·숫자 다 돼요, 띄어쓰기는 빼 주세요)
  inviteCode: "겨무밤2026",
  // 🔑 사장님 비밀번호 — 찻집 ⚙️ 설정의 [사장님 인증]에 이 번호를 넣으면 사장님 모드가 켜져요 (꼭 바꿔 주세요!)
  ownerPin: "1234",
  // 🔐 관리자(주인장) 계정 UID — 여기에 적으면 비밀번호(ownerPin) 대신 "관리자 이메일 로그인"으로만 사장님 모드가 켜져요
  //    Firebase 콘솔 → Authentication → 사용자 → 내 계정의 "사용자 UID"를 복사해 붙여 넣어요 (비워 두면 예전처럼 ownerPin)
  adminUid: "",
  // 🎵 찻집 BGM (내가 만든 음악) — mp3를 public 폴더에 올리고 주소와 제목을 적어요 (예: "/cafe_bgm.mp3")
  //    비워 두면 찻집에는 BGM이 없어요 (설정창에도 안 보여요)
  teaHouseBgm: "",
  teaHouseBgmTitle: "",
  // 🍵 군산 온라인 찻집 차림표 (카운터 근처 [🍵 차림표 보기])
  //   id: 영어·숫자로 겹치지 않게 (사장님 메뉴 상태·손님 투표·피드백이 이 id로 저장돼요)
  //   story: 메뉴에 담긴 이야기 / price: 예정 가격 (비워 둬도 돼요)
  teaMenu: {
    title: "겨울 차림표",
    subtitle: "군산의 계절을 한 잔에 담았어요",
    // 🫖 다구 쇼룸 (스마트스토어 주소로 바꿔 주세요)
    showroomUrl: "https://smartstore.naver.com/",
    items: [
      { id: "maesil", emoji: "🍵", category: "차", name: "군산 매실차", price: "6,000원", description: "새콤하고 따뜻한 겨울 매실차", story: "초여름 군산 들녘에서 딴 청매실을 설탕에 백일 동안 재웠어요. 따뜻한 물에 풀면 새콤한 향이 먼저 올라와요." },
      { id: "matcha", emoji: "🍵", category: "차", name: "말차 한 사발", price: "7,000원", description: "다완에 직접 격불한 말차", story: "대나무 차선으로 거품을 곱게 내서 다완 그대로 드려요. 쌉싸름한 맛 뒤에 단맛이 남아요." },
      { id: "yuja", emoji: "🍋", category: "차", name: "유자 생강차", price: "6,000원", description: "감기 기운 있을 때 한 잔", story: "고흥 유자에 생강을 얇게 저며 함께 담갔어요. 목이 칼칼한 겨울밤에 잘 어울려요." },
      { id: "bonibam", emoji: "🌰", category: "다식", name: "수제 보늬밤", price: "5,000원", description: "속껍질째 조린 달콤한 밤", story: "공주 밤의 속껍질을 살려 사흘 동안 천천히 조렸어요. 껍질의 쌉쌀함과 시럽의 단맛이 함께 나요." },
      { id: "gotgam", emoji: "🍊", category: "다식", name: "곶감 호두말이", price: "5,500원", description: "쫀득한 곶감 속 고소한 호두", story: "상주 곶감을 펴서 호두를 넣고 돌돌 말아 썰었어요. 차 한 모금, 곶감 한 입이 제일 잘 맞아요." },
      { id: "dasik", emoji: "🍡", category: "다식", name: "오색 다식", price: "4,000원", description: "송화·흑임자·콩가루 다식", story: "다식판에 꾹꾹 눌러 찍은 다섯 가지 색 다식이에요. 입에서 사르르 녹아요." },
    ],
  },
  // 🫖 다구 판매존 쇼룸 (찻집 오른쪽 선반) — url을 비우면 storeUrl(스마트스토어)로 연결돼요
  teaShowroom: {
    title: "다구 쇼룸",
    subtitle: "찻집에서 쓰는 다구를 집에서도 만나 보세요",
    storeUrl: "https://smartstore.naver.com/",
    items: [
      { emoji: "🫖", name: "백자 다관", price: "38,000원", description: "손에 감기는 작은 다관", url: "" },
      { emoji: "🍵", name: "분청 다완", price: "45,000원", description: "말차 격불용 넉넉한 다완", url: "" },
      { emoji: "🎋", name: "대나무 차선", price: "18,000원", description: "100본 차선 · 말차 거품용", url: "" },
      { emoji: "🍶", name: "숙우 & 찻잔 세트", price: "32,000원", description: "2인 찻잔 + 숙우", url: "" },
    ],
  },
  // (선택) 찻집 BGM — 비워 두면 bgmFile 을 써요
  teaHouseBgm: "",
  // 🍡🍵 다도 체험존 (찻집 미니게임) — 완성 화면의 [🛍️ ...] 버튼이 여기 주소로 연결돼요 (스마트스토어 상품 주소로 바꿔 주세요)
  teaCraft: {
    dasikKits: {
      bonibam: { label: "보늬밤 DIY 키트 / 제철 군산 밤 공구 보러가기", url: "https://smartstore.naver.com/" },
      gotgam: { label: "곶감 호두말이 DIY 키트 / 상주 곶감 공구 보러가기", url: "https://smartstore.naver.com/" },
      maesil: { label: "매실청 DIY 키트 / 청매실 공구 보러가기", url: "https://smartstore.naver.com/" },
    },
    matchaKit: { label: "말차 · 차선 · 다완 세트 보러가기", url: "https://smartstore.naver.com/" },
  },
    // 파티 BGM (내 음악 파일) — public 폴더에 넣고 "/파일이름.mp3" 로 적어요
  bgmFile: "/bgm.mp3",
  // (선택) 트리 그림 — 배경에 트리가 없으면 "/tree.png" 처럼 넣어 주세요. 비워 두면 배경의 트리를 그대로 써요
  treeImage: '',
  // 식탁 위 음식 (왼쪽부터 시계 방향) — id는 mapConfig.js의 FOOD_SPOTS와 같아야 해요
  foods: [
    {
      id: 'food1',
      emoji: '🍝',
      image: '/foods/lasagna.png', // public/foods 폴더의 그림
      name: '라자냐',
      description: '겨무밤의 시그니처. 다섯 번의 겨무밤을 함께 했어요.',
    },
    {
      id: 'food2',
      emoji: '🍎',
      image: '/foods/apple.png', // public/foods 폴더의 그림
      name: '사과와 아몬드스프레드',
      description: '호주에서 매일 먹었던 조합.',
    },
    {
      id: 'food3',
      image: '/foods/boni.png', // public/foods 폴더의 그림
      emoji: '🌰',
      name: '보늬밤',
      description:
        '군산에서의 첫 가을, 햇밤으로 만들었어요. 엄청난 노동의 산물!',
    },
    {
      id: 'food4',
      image: '/foods/mgpizza.png', // public/foods 폴더의 그림
      emoji: '🍕',
      name: '마르게리따 피자',
      description:
        '애인에게 피자를 만드는 취미가 생기면, 최고의 마르게리따 피자를 먹을 수 있죠. \n 단, 거대한 오븐 필요!',
    },
    {
      id: 'food5',
      image: '/foods/baechu.png', // public/foods 폴더의 그림
      emoji: '🥬',
      name: '부추 양배추 돼지고기 볶음',
      description:
        '도시락 단골 메뉴. \n저렴한 재료지만 언제 먹어도 맛있는 반찬.',
    },
  ],

  // 올해의 책 (color = 책등과 표지 색)
  books: [
    {
      id: 'book1',
      title: '면도날',
      author: 'W.서머싯 몸',
      color: '#203f90',
      comment:
        '어떤 땐 이런 생각이 들어. 이런 것 저런 것 고민하는 나라는 사람은 도대체 어떤 존재일까? 내가 거만하고 몹쓸 인간이라서 그런걸지도 몰라. 나도 남들 가는 길을 가면서, 그럭저럭 세상사에 순응하면서 사는 게 현명하지 않을까? 그런 생각 말이야.',
    },
    {
      id: 'book2',
      title: '빈 배처럼 텅 비어',
      author: '최승자',
      color: '#020650',
      comment: '나는 항상 나를 탈출한다. 그러나 결코 벗어나지 못한다.',
    },
    {
      id: 'book3',
      title: '삶의 한가운데',
      author: '루이제 린저',
      color: '#ea5503',
      comment: '나는 가끔 니나였고, 동시에 대체로 슈타인이었다..',
    },
    {
      id: 'book4',
      title: '변신',
      author: '프란츠 카프카',
      color: '#ce9a3a',
      comment: '그 누가 그레고리에게 뭐라 할 수 있나!',
    },
    {
      id: 'book5',
      title: '시대예보 - 수고인류의 시간',
      author: '송길영',
      color: '#5a524d',
      comment:
        '밖에서 보면 지나치게 사소한 차이에 집착하는 것처럼 보여도, 당사자에게는 그 차이를 알아주는 사람이 있다는 사실 자체가 즐거움입니다. 수고를 알아보는 눈과 그것을 알아봐 주는 사람이 만날 때, 수고의 가치는 비로소 선명해집니다.',
    },
    {
      id: 'book6',
      title: '안녕이라 그랬어',
      author: '김애란',
      color: '#115b36',
      comment:
        '고마움이란 건 왜 꼭 받아 마땅한 사람에게 전하는 게 이토록 힘든걸까.',
    },
    {
      id: 'book7',
      title: '달과 6펜스',
      author: 'W.서머싯 몸',
      color: '#3d7038',
      comment: '추는 항상 좌우로 흔들리고, 사람들은 같은 원을 늘 새롭게 돈다.',
    },
    {
      id: 'book8',
      title: '크눌프',
      author: '헤르만 헤세',
      color: '#063031',
      comment: '헤세, 편안함에 이르렀나?',
    },
  ],

  // 그룹 통화 초대장 (식탁 위 봉투)
  //  - links: 통화 주소 (Google Meet, Zoom 등 여러 개 가능 / https:// 로 시작해야 해요)
  //  - note: 비밀번호 같은 안내 (없으면 지워도 돼요)
  call: {
    title: '🎄 RE : 겨무밤 Live 초대장', // 창 맨 위 제목
    time: '12월 19일 (토) 저녁 7시', // 빨간 날짜 띠
    message:
      '우리 구글 MEET에서 만나요.\n편한 옷, 따뜻한 음료와 간식 챙겨 오세요 ☕', // 편지 내용 (\n = 줄바꿈)
    host: '주인장', // "— 파티 주인 드림"
    links: [
      { label: 'Google Meet 가기', url: 'https://meet.google.com/csi-kfed-nxk' }, // 버튼 글자, 통화 주소
    ],
    image: '', // (선택) 봉투 그림 — 비워 두면 코드로 그린 도트 봉투가 보여요
  },
  // 올해의 문장 (올해 읽은 책에서 좋았던 문구)
  //  - text: 문장 / book: 책 제목 / author: 지은이 (book, author는 비워도 돼요)
  //  - 줄을 복사해서 문장을 더 추가할 수 있어요
  quotes: [
    {
      text: '여기에 마음에 남은 문장을 적어 주세요.',
      book: '책 제목',
      author: '지은이',
    },
    {
      text: '두 번째 문장도 이렇게 추가할 수 있어요.',
      book: '책 제목',
      author: '지은이',
    },
  ],
  // (선택) 올해의 문장 액자 그림 — 비워 두면 코드로 그린 도트 액자가 보여요
  quoteFrameImage: '',

  // 올해의 영화 (poster = 포스터 이미지 경로, 없으면 color + emoji로 표시)
  movies: [
    {
      id: 'movie1',
      title: '가능한 사랑',
      director: '이창동',
      year: 2026,
      emoji: '🚉',
      color: '#1e3a8a',
      poster: '/posters/movie1.png',
      comment:
        '사랑을 가능하게 하는 것과 불가능하게 하는 것, \n 그 차이를 만드는 건 불가능하다고 생각하는 나의 마음 때문일까 아니면 그것이 결코 가능하지 않기 때문일까? \n미옥 화이팅',
    },
    {
      id: 'movie2',
      title: '거북이는 의외로 빨리 헤엄친다',
      director: '미키 사토시',
      year: 2005,
      emoji: '🎻',
      color: '#9a3412',
      poster: '/posters/movie2.png',
      comment:
        '슈팅스타 같았던 코미디. 26년 상반기 본 최고의 코미디 영화.    \n아즈키 판다짱~ \n토모도 돈토통~',
    },
    {
      id: 'movie3',
      title: '아니마',
      director: '폴 토마스 앤더슨',
      year: 2019,
      emoji: '🪐',
      color: '#4c1d95',
      poster: '/posters/movie3.png',
      comment: '15분에 담긴 인생. \n나는 무엇에 그토록 매료되었는가',
    },
  ],
};
