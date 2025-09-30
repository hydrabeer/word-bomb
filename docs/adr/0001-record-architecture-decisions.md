# ADR 0001 – Record Architecture Decisions

**Date:** 2025‑09‑30  
**Status:** Accepted  
**Deciders:** Maintainers  
**Technical Story:** Establishing a durable design log  

---

## Context

As Word Bomb grows (frontend, backend, shared domain packages), we will make repeated design choices about architecture, technology, and protocols. These decisions:
- Are often subtle and affect multiple workspaces.
- Might be questioned in the future (“Why Socket.IO vs raw WebSocket?”).
- Need context preserved beyond commit messages and PRs.

Without a structured record, rationale is easily lost.

---

## Decision

- We will **record architecture decisions as ADRs**.
- We adopt the **MADR (Markdown Any Decision Records)** template, stored under `docs/adr/`.
- Each ADR has a **monotonic ID** (0001, 0002, …) and follows the MADR sections: Context, Decision, Consequences, Alternatives, etc.
- Status lifecycle: `Proposed → Accepted → Superseded → Deprecated`.
- ADRs are committed with the feature/decision PR when possible.

---

## Consequences

- **Pros**
  - Transparent history of technical choices.
  - Easier onboarding: new contributors can see why we picked an approach.
  - Consistency with industry practice; tools/readers expect ADR-0001.

- **Cons**
  - Slight overhead to maintain.
  - Requires discipline: decisions must be captured, not just implicit.

---

## Alternatives considered

- **Rely on commit messages/PRs only:** Too granular, not synthesized; context lost across repos.
- **Google Docs/Notion pages:** Less durable, not colocated with code; risk of link rot.

---

## Implementation notes

- Directory: `docs/adr/`.
- Filename convention: `0001-record-architecture-decisions.md`.
- Use consistent headings (Context, Decision, Consequences, Alternatives).
- Tooling optional (no generator required).

---

## Follow‑ups

- ADR‑0002 already established: Socket Event Protocol & Versioning.
- Next likely ADR: dictionary ingestion + fragment indexing strategy.

