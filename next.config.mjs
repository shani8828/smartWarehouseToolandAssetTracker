/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Keep these as normal Node dependencies instead of bundling them
    serverComponentsExternalPackages: ["mongoose", "bcryptjs", "nodemailer"],
  },
};

export default nextConfig;
