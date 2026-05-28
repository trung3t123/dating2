# Dating Maze

Webgame phong cách Pacman + mê cung hẹn hò. Mỗi màn là một quyết định date; bốn cổng exit = bốn lựa chọn. Cuối game nhận ending theo lộ trình.

## Chạy local

```bash
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

## Điều khiển

- **WASD** hoặc **mũi tên** — di chuyển
- **Space** — dash (cooldown ngắn)
- **Vuốt** trên mobile — đổi hướng
- Chạm cổng exit có nhãn (Hotpot, BBQ, …) để khóa lựa chọn và sang màn tiếp

## Cấu trúc

- `src/game/scenes/` — Phaser (menu, maze, transition, ending)
- `src/game/stages.ts` — 4 màn + palette + lựa chọn
- `src/game/endings.ts` — logic ending
- `src/components/` — React HUD (Framer Motion)

## Tech

Next.js · React · Tailwind · Phaser 3 · Framer Motion
