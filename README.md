# Word Bomb

## Overview

This monorepo is a reimagining of the classic game _Bomb Party_, built with
modern web tech.  
Players race against the bomb timer to type real words containing a given
fragment — miss it, and
you lose a life! Last player standing wins.

Built with:

- 🧠 TypeScript
- ⚛️ React + React Router
- ⚡ Vite
- 🎨 Tailwind CSS
- 📡 Express + Socket.IO
- 📦 pnpm Workspaces

---

## 🧰 Prerequisites

Make sure you have the following installed:

### Node.js

Install via [nodejs.org](https://nodejs.org/) or a version manager
like [nvm](https://github.com/nvm-sh/nvm).

### pnpm ([monorepo](https://monorepo.tools/#what-is-a-monorepo) package manager)

Enable pnpm with Corepack (requires Node.js v18+):

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

Alternatively, install manually with:

```bash
npm install -g pnpm
```

## 📦 Setup

### 1. Clone the repo

```bash
git clone https://github.com/hydrabeer/word-bomb.git
cd word-bomb
```

### 2. Install dependencies with pnpm

```bash
pnpm install
```

### 3. Setup dev environment

You'll need to define a .env file containing:

```.dotenv
VITE_BACKEND_URL=http://localhost:3001
```

for the backend server to work.

### 4. Start the server

```bash
pnpm dev
```

## 🔐 Dictionary Setup

This project uses a large (secret!) dictionary for word validation.

As a developer, you can place place your own dictionary at:

```
apps/backend/src/dictionary/words.txt
```

(It's gitignored.)

## 🛠 Packages

- [apps/frontend](apps/frontend): React + Vite client
- [apps/backend](apps/backend): Express + Socket.IO server
- [packages/domain](packages/domain): Shared game logic and types

## 🧪 Scripts

```bash
pnpm dev         # Run dev servers
pnpm lint        # Run eslint across packages
pnpm format      # Format codebase with Prettier
```
