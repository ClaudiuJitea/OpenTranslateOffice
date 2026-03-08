import { env } from "./config/env";
import { createApp } from "./app";

const app = await createApp();
app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on :${env.PORT}`);
});
