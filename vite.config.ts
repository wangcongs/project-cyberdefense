import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { viteSingleFile } from "vite-plugin-singlefile";

// OFFLINE=1 时构建「离线单文件」产物：所有 JS/CSS 全部内联进一个 index.html，
// 双击即可用浏览器打开（file://），不需要网络、不需要服务器。
const isOffline = process.env.OFFLINE === "1";

export default defineConfig({
  base: isOffline ? "./" : "/",
  plugins: [
    react(),
    ...(isOffline ? [viteSingleFile()] : []),
  ],
  build: {
    sourcemap: !isOffline,
    outDir: isOffline ? "out-offline" : "out",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: "127.0.0.1",
  },
});
