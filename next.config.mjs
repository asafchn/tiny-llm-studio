/** @type {import('next').NextConfig} */
const nextConfig = {
  // shiki loads grammars dynamically; keep it out of the server bundle
  serverExternalPackages: ['shiki'],
  poweredByHeader: false,
};

export default nextConfig;
