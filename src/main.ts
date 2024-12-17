import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { INestApplication } from '@nestjs/common';

async function bootstrap() {
    const app: INestApplication = await NestFactory.create(AppModule);
    await app.listen(process.env.PORT ?? 8080);
}

void bootstrap();
