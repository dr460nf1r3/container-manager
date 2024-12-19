import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from 'helmet';
import { provideSwagger } from './api/setup-swagger';
import { initLoglevel } from './functions';

async function bootstrap(): Promise<void> {
  const app: INestApplication = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      whitelist: true,
    }),
  );
  app.use(helmet());

  provideSwagger(app);
  initLoglevel(process.env.CONFIG_LOGLEVEL ?? 'log');

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
