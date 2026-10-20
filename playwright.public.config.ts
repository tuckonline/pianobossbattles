import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir:"./tests/public-browser", workers:1, timeout:60000,
  use:{baseURL:"http://localhost:5173",viewport:{width:1440,height:1100},headless:true},
  reporter:"list",
});
