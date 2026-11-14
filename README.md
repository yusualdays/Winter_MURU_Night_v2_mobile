This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

겨울이 무르익는 밤

---

## 📱 모바일 최적화 (추가된 내용)

- **카메라 추적**: 폰처럼 좁은 화면(맵 전체 배율 < 0.45)에서는 맵 전체를 줄여 보여주지 않고, 0.75배로 키워 내 캐릭터를 따라가요. (`app/living-room/page.js`의 `CAMERA_FIT_BELOW`, `CAMERA_ZOOM`, `UI_BOOST`)
- **터치 UI**: 방향 패드 + 행동(E) 버튼 + 💬 말하기 / 😊 표정 / 🥂 건배 / 📜 채팅 기록 버튼. 버튼 자리는 `globals.css`의 `.mhud-*` 클래스.
- **채팅 입력**: 버튼을 누르는 순간 focus → 아이폰에서도 키보드가 뜨고, 키보드 위로 입력창이 따라 올라가요. [보내기] 버튼 추가.
- **화면 설정**: `viewport-fit=cover`, 확대 방지, `100dvh`, 노치·홈바 안전 영역, 당겨서 새로고침 방지.
- **입장 화면**: 캐릭터 꾸미기가 아래에서 올라오는 시트로, 미리보기는 위에 고정.
- **성능**: 움직이지 않는 맵 요소(식탁·포스터·트리 등)는 `memo`로 매 프레임 다시 그리지 않아요.
- 안 쓰이던 Geist 구글 폰트 제거 (폰트 요청 2개 절약).
