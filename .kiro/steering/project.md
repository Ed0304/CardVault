# CardVault — Project Steering

## Project Overview

CardVault is a hackathon project for managing and storing cards (e.g., trading cards, collectibles, or digital cards). The project is in early development with a Nuxt 4 frontend and dual backend options (Express.js and FastAPI).

## Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Frontend    | Nuxt 4, Vue 3.5, Vue Router 5, TypeScript |
| Backend A   | Express.js v5 (Node.js)           |
| Backend B   | FastAPI (Python)                  |

## Project Structure

```
/
├── backend/
│   ├── expressjs/     # Node.js Express v5 API server
│   └── fastapi/       # Python FastAPI server
└── frontend/
    └── cardvault/     # Nuxt 4 application
```

## Development Guidelines

- **Frontend**: All Vue components use the Composition API with `<script setup>`. TypeScript is preferred throughout.
- **Backend (Express)**: Use async/await patterns. Keep routes in separate files under a `routes/` directory.
- **Backend (FastAPI)**: Follow RESTful conventions. Use Pydantic models for request/response validation.
- **API Design**: REST APIs should use consistent response shapes: `{ data, error, message }`.
- **Naming**: Use `camelCase` for JS/TS variables and functions, `PascalCase` for Vue components and Python classes, `snake_case` for Python variables and FastAPI route functions.
- **Error handling**: Always handle errors at the API boundary — return meaningful HTTP status codes and messages.

## Running the Project

```powershell
# Frontend (Nuxt dev server)
cd frontend/cardvault
npm run dev

# Backend — Express
cd backend/expressjs
node index.js

# Backend — FastAPI
cd backend/fastapi
uvicorn app:app --reload
```

## Hackathon Notes

- Keep scope tight — prioritise a working demo over feature completeness.
- The nested `.git` inside `frontend/cardvault` may cause submodule issues — prefer committing from the root repo.
- Do not ignore the `.kiro/` folder in any `.gitignore`.
