# Builds the static site (docs/) with Node 24. Used by build.sh.
FROM docker.io/library/node:24-slim AS build

WORKDIR /app

# No .git in the build context, so skip husky's git hook install during npm ci
ENV HUSKY=0

# Dependencies first: this layer is reused until package.json or the lockfile
# changes, and the npm cache mount speeds up reinstalls when they do.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
RUN npm run build

# Export stage: only the built site, written to docs/ by build.sh (--output)
FROM scratch AS out
COPY --from=build /app/docs /
