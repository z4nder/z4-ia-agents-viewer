/** Run both services and stop the other one if either exits. */
const services = [
    Bun.spawn([process.execPath, 'run', 'api'], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' }),
    Bun.spawn([process.execPath, 'run', 'dev:web'], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' }),
];

function stop() {
    for (const service of services) {
        service.kill();
    }
}

process.on('SIGINT', () => {
    stop();
    process.exit(130);
});
process.on('SIGTERM', () => {
    stop();
    process.exit(143);
});

const exitCode = await Promise.race(services.map((service) => service.exited));
stop();
await Promise.all(services.map((service) => service.exited));
process.exit(exitCode);
