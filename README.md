# Word Bomb

[![codecov](https://codecov.io/gh/hydrabeer/word-bomb/graph/badge.svg?token=CZU4XTPVQK)](https://codecov.io/gh/hydrabeer/word-bomb)

# Table of Contents

- [Overview](#overview)
- [🧰 Prerequisites](#-prerequisites)
  - [Node.js](#nodejs)
  - [pnpm (monorepo package manager)](#pnpm-monorepo-package-manager)
- [📦 Setup](#-setup)
  - [1. Clone the repo](#1-clone-the-repo)
  - [2. Install dependencies with pnpm](#2-install-dependencies-with-pnpm)
  - [3. Setup dev environment](#3-setup-dev-environment)
  - [4. Start the server](#4-start-the-server)
- [🔐 Dictionary Setup](#-dictionary-setup)
- [🛠 Packages](#-packages)
- [🧪 Scripts](#-scripts)

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

You'll need to make a file, `apps/frontend/.env`, containing:

```.dotenv
VITE_BACKEND_URL=http://localhost:3001
```

for the backend server to work.

### 4. Start the server

Run this from the root of the repo to start both the frontend and backend servers:

```bash
pnpm dev
```

## 🔐 Dictionary Setup

This project uses a large (secret!) dictionary for word validation.

As a developer, you can find your own dictionary for testing and place it at:

```
apps/backend/src/dictionary/words.txt
```

(It's already gitignored.)

## 🛠 Packages

- [apps/frontend](apps/frontend): React + Vite client
- [apps/backend](apps/backend): Express + Socket.IO server
- [packages/domain](packages/domain): Shared game logic and types

## 🧪 Scripts

The following scripts are available in the root of the repo:

```bash
pnpm dev         # Run dev servers
pnpm lint        # Run eslint across packages
pnpm format      # Format codebase with Prettier
```

All three of these should be run and any errors fixed before committing code.
