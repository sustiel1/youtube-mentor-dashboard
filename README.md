# YouTube Mentor Dashboard

> Before making UI, save-flow, topic, Workspace, Obsidian, Brain, GEM, or analysis changes, read [`AI_DEVELOPMENT_GUIDE.md`](./AI_DEVELOPMENT_GUIDE.md).

A management system for organizing, learning, and analyzing YouTube content — focused on improving learning workflows and strategies.

Built with React, Vite, and Base44. Includes an admin panel, E2E testing with Playwright, and automated CI via GitHub Actions.

---

## 🚀 Features

- **Dashboard** — Centralized view for managing learning content and mentor data
- **Admin Panel** — Full control over mentors, topics, and RSS feeds
- **Base44 Integration** — Backend, entities, and environment variables managed via Base44
- **E2E Tests** — Automated smoke tests with Playwright
- **CI Pipeline** — GitHub Actions runs tests on every push and pull request

---

## ⚙️ Tech Stack

- **Frontend** — React 18, Vite 6
- **UI** — Tailwind CSS, Radix UI, Lucide React
- **Backend / Platform** — Base44
- **Testing** — Playwright
- **CI** — GitHub Actions

---

## ▶️ Open the Project

```bash
git clone https://github.com/sustiel1/youtube-mentor-dashboard.git
cd youtube-mentor-dashboard
npm install
cp .env.example .env.local
npm run dev
```

Open in browser:

```text
http://localhost:5173
```

> If `.env.example` is missing, create `.env.local` manually and configure your Base44 environment variables inside it.

---

## ⚡ Quick Start

```bash
git clone https://github.com/sustiel1/youtube-mentor-dashboard.git
cd youtube-mentor-dashboard
npm install
npm run dev
```

---

## 📸 Screenshots

![Dashboard](./screenshots/dashboard.png)
![Admin](./screenshots/admin.png)

---

## 📦 Installation

### Prerequisites

- Node.js 20+
- npm

### Clone and install

```bash
git clone https://github.com/sustiel1/youtube-mentor-dashboard.git
cd youtube-mentor-dashboard
npm install
```

### Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

> Never commit `.env.local` or any file containing real API keys. See `.gitignore`.

Make sure to configure your environment variables in `.env.local` before running the project.

---

## ▶️ Usage

### Run development server

```bash
npm run dev
```

Opens at `http://localhost:5173`

### Build for production

```bash
npm run build
```

---

## 🧪 Testing

### Run E2E tests

```bash
npm run test:e2e
```

### Run with UI mode

```bash
npm run test:e2e:ui
```

---

## Project Structure

```
src/
├── components/
│   └── layout/
├── pages/
e2e/
.github/
└── workflows/
    └── e2e.yml
```

---

## 🛠️ CI/CD

E2E tests run automatically on every push and pull request to `main`.
On failure, artifacts are uploaded (`playwright-report/` and `test-results/`) for debugging.

---

## 🗺️ Roadmap

- [ ] Add authentication
- [ ] Improve analytics
- [ ] Add AI insights
- [ ] Deploy to production

---

## License

Private project. All rights reserved.
