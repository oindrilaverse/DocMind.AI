# Contributing to DocMind.AI

Thank you for your interest in contributing to **DocMind.AI**! As an enterprise-grade AI knowledge assistant, we hold ourselves to high code quality and architectural standards. Following these guidelines helps ensure a smooth contribution process.

---

## 🛠️ Development Workflow

1. **Fork the Repository**: Create a personal copy of the repository on GitHub.
2. **Setup Local Environment**: Follow the [README.md](README.md) instructions to configure PostgreSQL, Ollama models, and package dependencies.
3. **Create a Feature Branch**: Use descriptive naming (e.g. `feat/hybrid-search` or `fix/auth-cookie`).
4. **Implement Changes**: Ensure your code meets the quality standards below.
5. **Run Verification Commands**:
   - Check TypeScript compilation: `npm run build`
   - Ensure linting and formatting pass.
6. **Submit a Pull Request (PR)**: Provide a clear summary of your changes, referencing any related issues.

---

## 📐 Coding Standards

- **TypeScript Strict Mode**: Always write type-safe code. Avoid using `any` type casts wherever possible.
- **Decoupled Architecture**: Follow the provider-based layer model (e.g. controllers delegate to services, which call interface-based providers). Do not bleed database logic or LLM clients directly into controllers or UI routes.
- **Security First**: Do not commit secrets, private keys, or actual environment files. Utilize `.env.example` placeholders.
- **Inline Documentation**: Document complex logic blocks and services using clear, beginner-friendly TSdoc comments.

---

## 🤖 Pull Request Guidelines

Before submitting your PR, double check that your branch:
- Build completes successfully (`npm run build`).
- No warning logs or unused imports remain.
- Commit messages follow the [Conventional Commits](https://www.conventionalcommits.org/) format (e.g., `feat: implement cohere reranking provider`).
