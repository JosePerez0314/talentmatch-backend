# TalentMatch AI — Backend

> B2B platform that automates candidate screening for HR teams: it extracts data from PDF CVs with AI, scores them deterministically against a vacancy's requirements, and returns an explainable candidate ranking.
> Plataforma B2B que automatiza el filtrado de candidatos para equipos de RRHH: extrae datos de CVs en PDF con IA, los puntúa de forma determinística contra los requisitos de una vacante y devuelve un ranking explicable.

**Stack:** Node.js · Express 5 · TypeScript · MySQL · Prisma · Zod · OpenAI · Cloudinary

---

## 📚 Documentation / Documentación

All documentation lives in [`docs/`](./docs/), in both English and Spanish.
Toda la documentación vive en [`docs/`](./docs/), en inglés y español.

| | 🇬🇧 English | 🇪🇸 Español |
| --- | --- | --- |
| **Backend architecture** (start here) | [`docs/en/backend-documentation.md`](./docs/en/backend-documentation.md) | [`docs/es/backend-documentation.md`](./docs/es/backend-documentation.md) |
| **API reference** | [`docs/en/api-documentation.md`](./docs/en/api-documentation.md) | [`docs/es/api-documentation.md`](./docs/es/api-documentation.md) |
| **Quick start / README** | [`docs/en/readme.md`](./docs/en/readme.md) | [`docs/es/readme.md`](./docs/es/readme.md) |
| **Frontend changelog** | [`docs/en/changelog-frontend.md`](./docs/en/changelog-frontend.md) | [`docs/es/changelog-frontend.md`](./docs/es/changelog-frontend.md) |
| **Recent changes log** | [`docs/en/last-changes.md`](./docs/en/last-changes.md) | [`docs/es/last-changes.md`](./docs/es/last-changes.md) |

Documentation index: [`docs/README.md`](./docs/README.md).
Engineering & contribution rules: [`CLAUDE.md`](./CLAUDE.md).

## 🚀 Quick start / Arranque rápido

```bash
npm install
docker compose -f docker-compose.local.yml up -d   # MySQL only / solo MySQL
# configure your .env (see docs/en/readme.md § Environment variables)
npx prisma generate && npx prisma migrate dev
npx prisma db seed                                  # optional / opcional
npm run dev
```

Full setup, scripts, environment variables and testing details are in the READMEs under [`docs/`](./docs/).
El setup completo, scripts, variables de entorno y detalles de testing están en los READMEs dentro de [`docs/`](./docs/).

## License

ISC — see `package.json`.
