const fs = require("fs");

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_ROOT_URL || "not set";

if (backendUrl.includes("localhost")) {
  const certPath = "./aspnet-dev-cert.pem";
  if (fs.existsSync(certPath)) {
    process.env.NODE_EXTRA_CA_CERTS = certPath;
  } else {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
}

const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
