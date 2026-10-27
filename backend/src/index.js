import { createApp } from './server.js';
import { getConfig } from './config.js';

const config = getConfig();
const app = createApp(config);

app.listen(config.port, '0.0.0.0', () => {
  console.log(`EventHub API listening on port ${config.port} on all network interfaces`);
});
