
import axios from 'axios';
import { spawn } from 'child_process';

const PORT = 5001;
const BASE_URL = `http://localhost:${PORT}`;

async function runSmokeTest() {
  console.log('Starting server smoke test...');

  // Start the server
  console.log('Starting server process...');
  const server = spawn('npm', ['run', 'dev'], {
    stdio: 'pipe',
    shell: true,
    env: { ...process.env, PORT: String(PORT) }
  });

  let serverRunning = false;
  
  // Log server output
  server.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[Server]: ${output}`);
    if (output.includes('Server started') || output.includes('ready')) {
        serverRunning = true;
    }
  });

  server.stderr.on('data', (data) => {
    console.error(`[Server Error]: ${data}`);
  });

  // Wait for server to start
  console.log('Waiting for server to be ready...');
  await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s

  try {
    // Test 1: Health check / Status
    console.log('Testing /api/admin/status...');
    try {
        const statusRes = await axios.get(`${BASE_URL}/api/admin/status`);
        console.log('Status Check: PASSED', statusRes.status);
    } catch (e: any) {
        console.log('Status Check: FAILED', e.message);
    }

    // Test 2: Get Categories
    console.log('Testing /api/categories...');
    try {
        const catRes = await axios.get(`${BASE_URL}/api/categories`);
        console.log('Categories Check: PASSED', catRes.status, `Found ${catRes.data.length} categories`);
    } catch (e: any) {
        console.log('Categories Check: FAILED', e.message);
    }

    // Test 3: Get Studies
    console.log('Testing /api/studies...');
    try {
        const studiesRes = await axios.get(`${BASE_URL}/api/studies?limit=5`);
        console.log('Studies Check: PASSED', studiesRes.status, `Found ${studiesRes.data.data?.length || 0} studies`);
    } catch (e: any) {
        console.log('Studies Check: FAILED', e.message);
    }

  } catch (error) {
    console.error('Smoke test failed with unexpected error:', error);
  } finally {
    console.log('Stopping server...');
    server.kill();
    process.exit(0);
  }
}

runSmokeTest();
