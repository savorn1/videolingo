# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Keeping types in step with the backend

The interfaces in `app/composables/*.ts` mirror the backend's response objects by hand, so a renamed
or removed field on the backend can go unnoticed until something breaks. The backend publishes its API
description (`/v3/api-docs`, open without a token), and this project can turn it into TypeScript types:

```bash
# with the backend running (default http://localhost:8080, or set NUXT_BACKEND_BASE)
npm run gen:api
```

This writes `shared/api.generated.d.ts`. It is not used by the app; it is there to compare against.
After a backend change, run it again and look at the diff (`git diff shared/api.generated.d.ts`): a renamed,
retyped or removed field shows up there. To have the compiler check a hand-written interface against it, add a
line such as:

```ts
import type { components } from '#shared/api.generated'
import type { Video } from '~/composables/useVideos'
// Fails to compile if the backend's VideoResponse no longer has what Video expects.
type _VideoMatchesBackend = Pick<components['schemas']['VideoResponse'], 'id' | 'title'> extends Pick<Video, 'id' | 'title'> ? true : never
```
