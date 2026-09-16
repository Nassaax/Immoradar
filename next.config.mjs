/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    // Hotlinking des photos d'agences est désactivé par défaut (voir README > Légal).
    // Seules les vignettes explicitement autorisées par une source sont chargées ici.
    remotePatterns: [],
  },
};

export default nextConfig;
