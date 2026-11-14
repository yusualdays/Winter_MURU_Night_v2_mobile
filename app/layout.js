import "./globals.css";

// (Geist 구글 폰트는 body가 Arial로 덮어써서 실제로 쓰이지 않았어요 → 제거해서
//  휴대폰에서 폰트 요청 2개를 아끼고, 인터넷이 느려도 첫 화면이 막히지 않게 했어요)

export const metadata = {
  title: "겨울이 무르익는 밤",
  description: "따뜻한 집 안에서 친구들이 기다리고 있어요",
  // 홈 화면에 추가하면 주소창 없이 앱처럼 열려요
  appleWebApp: { capable: true, title: "겨울밤", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

// 휴대폰 화면 설정
//  - viewportFit: cover → 노치·홈 바 영역까지 화면을 써요 (안전 영역은 CSS env()로 피함)
//  - 확대/축소 막기 → 게임 중 더블탭·핀치로 화면이 커지지 않게
//  - interactiveWidget: 키보드가 올라오면 화면 크기가 줄어들어 채팅창이 가려지지 않아요
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#020617",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
