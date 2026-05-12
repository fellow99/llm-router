import express from 'express';
import { loadConfig } from './config';
import { initializeProxies } from './proxy';
import { createRouter } from './routes';

async function main() {
  const config = loadConfig();
  const proxies = initializeProxies(config);

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/', createRouter(config, proxies));

  app.listen(config.listening_port, () => {
    config.logger.info(`LLM-Router listening on :${config.listening_port}`, {
      port: config.listening_port,
      backends: config.backends.map(b => b.name),
    });
  });
}

main();
