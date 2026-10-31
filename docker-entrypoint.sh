#!/bin/sh
set -e

# /app/db should be a persistent volume. On first start it is empty, so copy in
# the starting databases. Existing files are never overwritten.
mkdir -p /app/db
for file in /app/db-seed/*.sqlite; do
  [ -e "$file" ] || continue
  target="/app/db/$(basename "$file")"
  [ -e "$target" ] || cp "$file" "$target"
done

mkdir -p /app/uploads

# Volumes are often mounted as root, so hand them to the app user
chown -R nextjs:nodejs /app/db /app/uploads

# Run the server as the unprivileged user
exec setpriv --reuid=nextjs --regid=nodejs --init-groups "$@"
