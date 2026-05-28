import { spawn } from 'child_process';

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const appName = process.env.APP_NAME || 'Repositorio Aplicacao';

const services = [
  {
    name: 'api',
    args: ['run', 'dev', '--prefix', 'api']
  },
  {
    name: 'web',
    args: ['run', 'dev', '--prefix', 'web']
  }
];

const children = [];
let shuttingDown = false;

function stopAll(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }

  process.exit(exitCode);
}

for (const service of services) {
  const child = spawn(npmCommand, service.args, {
    stdio: 'inherit',
    shell: isWindows,
    env: process.env
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;

    if (signal) {
      stopAll(1);
      return;
    }

    stopAll(code ?? 0);
  });

  child.on('error', (error) => {
    console.error(`[${service.name}] ${error.message}`);
    stopAll(1);
  });

  children.push(child);
  console.log(`[${appName}] ${service.name} iniciado`);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => stopAll(0));
}
