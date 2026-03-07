/** @type {import('next').NextConfig} */
const https = require("https");
const fs = require("fs");

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_ROOT_URL || "not set";

// if backendurl contains localhost, we are in dev env and try loading self-signed cert
if (backendUrl.includes("localhost")) {
  console.log("Custom CA certificate will be loaded for HTTPS requests.");
  // Path to the self-signed certificate
  const certPath = "./aspnet-dev-cert.pem";
  
  if (fs.existsSync(certPath)) {
    process.env.NODE_EXTRA_CA_CERTS = certPath;
    console.log("Custom CA certificate loaded for HTTPS requests.");
  } else {
    console.warn("⚠️ Self-signed certificate not found. Using default CA.");
  }
}

const nextConfig = {
  async rewrites() {

    return [
      {
        source: "/api/account/googleresponse",
        destination: `${backendUrl}/api/account/googleresponse`
      },
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`
      },
    ];
  },
};

module.exports = nextConfig;
