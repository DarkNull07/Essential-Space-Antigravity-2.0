# Essential Space Antigravity 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a premium Swiss Gallery Style web dashboard where users can drop desktop assets and organize cards using Next.js, Prisma, Tailwind CSS v4, Framer Motion, and Supabase.

**Architecture:** A Next.js App Router workspace connected to Supabase Postgres via Prisma ORM. Utilizes `@dnd-kit/core` for internal component layout shifts and global window drop event listeners to handle native desktop file uploads.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, Framer Motion, `@dnd-kit/core`, `@dnd-kit/sortable`, Supabase Auth, Prisma ORM.

## Global Constraints
- Target workspace path: `D:\Desktop\Websites\Essential Space\Essential Space Antigravity 2.0`
- Use Swiss Gallery Style design tokens (Slate White background, Deep Ink borders, Safety Orange accent, Syne display font).
- Do not use native HTML5 drag-and-drop interfaces for internal cards reordering to avoid cross-browser layout bugs.
- Always check if component is mounted before rendering drag contexts to prevent hydration mismatches.

---

### Task 1: Project Scaffolding & Configuration

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `src/app/globals.css`

**Interfaces:**
- Produces: Base configuration files and root stylesheet.

- [ ] **Step 1: Create package.json with dependencies**
  Write package configuration file to `package.json`.
- [ ] **Step 2: Create next.config.ts**
  Write Next.js configuration for image loading domains.
- [ ] **Step 3: Create tsconfig.json**
  Write TS compile configuration.
- [ ] **Step 4: Create src/app/globals.css with design tokens**
  Define variables for color palette:
  - `--background: #F9F9FB`
  - `--foreground: #0B0C10`
  - `--muted: #EAEAEA`
  - `--accent: #FF5A36`
- [ ] **Step 5: Run npm install**
  Run `npm install` to setup project packages.
- [ ] **Step 6: Commit changes**
  Add files and run: `git commit -m "chore: scaffold project files and configuration"`

---

### Task 2: Database Layer & Prisma Setup

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`

**Interfaces:**
- Produces: PrismaClient database reference.

- [ ] **Step 1: Create schema.prisma**
  Define UserProfile, Category, and Card database entities.
- [ ] **Step 2: Create db.ts helper**
  Initialize and export a singleton PrismaClient instance.
- [ ] **Step 3: Run prisma validate**
  Run `npx prisma validate` to confirm file layout correctness.
- [ ] **Step 4: Commit changes**
  Commit the schema: `git commit -m "db: configure database models with prisma"`

---

### Task 3: Authentication & Middleware Setup

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/middleware.ts`
- Create: `src/app/login/page.tsx`

**Interfaces:**
- Produces: Supabase clients and middleware route guards.

- [ ] **Step 1: Create client.ts**
  Instantiate the Supabase browser client.
- [ ] **Step 2: Create server.ts**
  Instantiate the Supabase server client (headers & cookies aware).
- [ ] **Step 3: Create middleware.ts**
  Configure request routing: check cookies and redirect to `/login` if unauthenticated.
- [ ] **Step 4: Create login page**
  Build Swiss Gallery login interface (email passwordless form and Google connection layout).
- [ ] **Step 5: Commit changes**
  Run: `git commit -m "feat: integrate supabase authentication and session middleware"`

---

### Task 4: Layout and Drag-and-Drop Workspace Canvas

**Files:**
- Create: `src/components/Sidebar.tsx`
- Create: `src/components/Canvas.tsx`
- Create: `src/components/Card.tsx`
- Create: `src/app/page.tsx`

**Interfaces:**
- Consumes: Prisma database hooks and auth credentials.
- Produces: Full Swiss Gallery UI dashboard interface.

- [ ] **Step 1: Create Card component**
  Polymorphic card rendering text snippets, link previews, and file previews with technical dimensions.
- [ ] **Step 2: Create Sidebar component**
  Build category list with vertical sorting using `@dnd-kit/sortable`.
- [ ] **Step 3: Create Canvas component**
  Build the multi-column canvas. Register grid-aware sensors and native drop listener for orange outline overlay.
- [ ] **Step 4: Update home page page.tsx**
  Compose sidebar and canvas on the home route.
- [ ] **Step 5: Commit changes**
  Run: `git commit -m "feat: implement dashboard layout and drag-and-drop workspace"`
