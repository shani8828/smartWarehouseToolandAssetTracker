/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Keep these as normal Node dependencies instead of bundling them
    serverComponentsExternalPackages: ["mongoose", "bcryptjs", "nodemailer", "node-cron"],
    // Enables src/instrumentation.ts (hourly overdue audit)
    instrumentationHook: true,
  },
};

export default nextConfig;
