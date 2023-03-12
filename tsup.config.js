import { defineConfig } from "tsup";
//import { NodeResolvePlugin } from '@esbuild-plugins/node-resolve';

export default defineConfig({
  entry: ["src/index.ts"],
  splitting: false,
  sourcemap: false,
  clean: true,
  platform: "node",
  onSuccess: "tsc --project tsconfig.json",
});
