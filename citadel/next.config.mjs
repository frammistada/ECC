/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // The repo root's flat config targets the ECC plugin's CommonJS
    // scripts, not this app — it false-positives on ESM. Lint separately.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
