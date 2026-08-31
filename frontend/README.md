# Roy Judge Arena

Next.js frontend for Roy Judge Arena — an on-chain AI judge for Startups, Memes, and Poems on GenLayer.

## Setup

1. Install dependencies:

**Using bun:**
```bash
bun install
```

**Using npm:**
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Configure environment variables:
   - `NEXT_PUBLIC_CONTRACT_ADDRESS` - deployed RoyJudgeArena contract address
   - `NEXT_PUBLIC_STUDIO_URL` - GenLayer Studio URL (default: https://studio.genlayer.com/api)

## Development

**Using bun:**
```bash
bun dev
```

**Using npm:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Build

**Using bun:**
```bash
bun run build
bun start
```

**Using npm:**
```bash
npm run build
npm start
```

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS v4** - Styling with custom glass-morphism theme
- **genlayer-js** - GenLayer blockchain SDK
- **TanStack Query (React Query)** - Data fetching and caching
- **Radix UI** - Accessible component primitives
- **shadcn/ui** - Pre-built UI components

## Wallet Management

The app uses MetaMask with GenLayer's network:
- **Connect Wallet**: Connect MetaMask and switch to GenLayer
- **Switch Account**: Pick a different MetaMask account
- **Disconnect**: Clear the connected session

## Features

- **Submit entries**: Send a Startup, Meme, or Poem to the on-chain AI judge
- **Independent consensus**: Validators re-read the work and must agree on the score
- **Submission table**: Live scores, feedback, and authors
- **Leaderboard**: Rank wallets by total judged score
- **Player stats**: View your points from agreed judgments
- **Glass-morphism UI**: Premium dark theme with OKLCH colors, backdrop blur effects, and smooth animations
- **Real-time Updates**: Automatic data fetching via TanStack Query
