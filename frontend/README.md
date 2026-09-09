# Proof of Work

Next.js frontend for Proof of Work — an AI-verified bounty and grant platform on GenLayer.

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
   - `NEXT_PUBLIC_CONTRACT_ADDRESS` - deployed ProofOfWork contract address
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

- **Post bounties**: Lock a reward with a spec and deadline
- **Submit work**: Share a proof link for independent AI judgment
- **Independent consensus**: Validators re-read the work and must agree on Approved or Rejected
- **Escrow payout**: Approved work can release payment to the contributor
- **Glass-morphism UI**: Premium dark theme with OKLCH colors, backdrop blur effects, and smooth animations
- **Real-time Updates**: Automatic data fetching via TanStack Query
