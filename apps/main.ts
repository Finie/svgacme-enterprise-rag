import { NestFactory } from '@nestjs/core';
import {
  AppModule,
  ObserveInstrument,
  observeEnabled,
} from '@/app/app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
    observeEnabled ? { instrument: ObserveInstrument } : {},
  );
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000, process.env.HOST ?? '127.0.0.1');
}
await bootstrap();
