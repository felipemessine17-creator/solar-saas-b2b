// Regras de slug compartilhadas entre servidor e navegador (sem dependências de servidor).

export const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const RESERVED_SLUGS = [
  "login",
  "dashboard",
  "api",
  "auth",
  "admin",
  "app",
  "www",
  "static",
  "public",
  "_next",
  "favicon-ico",
];

export function isValidSlug(slug: string): boolean {
  return (
    slug.length >= 3 && slug.length <= 50 && SLUG_REGEX.test(slug) && !RESERVED_SLUGS.includes(slug)
  );
}
