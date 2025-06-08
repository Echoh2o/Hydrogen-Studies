// Minimal, stable, high-performance server implementation
async function main() {
  try {
    const { startMinimalServer } = await import("./minimal-stable-server");
    await startMinimalServer();
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

main();