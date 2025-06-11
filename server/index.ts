
import { createProductionServer } from './production-server.js';

async function main() {
  try {
    console.log('Starting Hydrogen Research Platform...');
    await createProductionServer();
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

main();
