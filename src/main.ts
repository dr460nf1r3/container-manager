import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import { provideSwagger } from './api/setup-swagger';
import { initLoglevel } from './functions';
import { fastifyReplyFrom } from '@fastify/reply-from';

async function bootstrap(): Promise<void> {
  const app: NestFastifyApplication = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  // Hook this early because we exit when SWAGGER_JSON is set
  await provideSwagger(app, process.env.SWAGGER_JSON === 'true');

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      whitelist: true,
    }),
  );
  await app.register(helmet);
  await app.register(fastifyReplyFrom);

  initLoglevel(process.env.CONFIG_LOGLEVEL ?? 'log');

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

void bootstrap();
