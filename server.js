import { createStaticServer } from './tests/server.js';

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

const server = createStaticServer();
server.start(PORT, HOST).then(({ port }) => {
  console.log(`\n======================================================`);
  console.log(`  🎂 BIRTHDAY SURPRISE WEBSITE SERVER LIVE! 🎂`);
  console.log(`======================================================`);
  console.log(`  Local URL:        http://localhost:${port}`);
  console.log(`  Network URL:      http://127.0.0.1:${port}`);
  console.log(`  Admin Portal:     http://localhost:${port}/admin.html`);
  console.log(`======================================================\n`);
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
