import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Libera os recursos de dev (HMR) quando o `next dev` é acessado de fora da
  // máquina — host remoto/SSH ou túnel público. Ajuste ao seu ambiente.
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
