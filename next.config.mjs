/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // three / drei / postprocessing ship modern ESM; transpile for stable builds.
  transpilePackages: ["three"],
};

export default nextConfig;
