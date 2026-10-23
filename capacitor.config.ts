import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ca.yourname.mbchildcare", // change once, before the first store upload — it can never change after
  appName: "MB Childcare Waitlist",
  webDir: "dist/public",
  server: { androidScheme: "https" },
};

export default config;
