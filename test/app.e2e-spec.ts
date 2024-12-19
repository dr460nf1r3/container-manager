import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';

let app: NestFastifyApplication;

beforeAll(async () => {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [await ConfigModule.forRoot()],
    controllers: [AppController],
    providers: [AppService],
  }).compile();

  app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});

it(`/GET root`, async () => {
  const result = await app.inject({
    method: 'GET',
    url: '/',
  });
  expect(result.statusCode).toEqual(404);
});

it(`/GET health`, async () => {
  const result = await app.inject({
    method: 'GET',
    url: '/health',
  });
  expect(result.statusCode).toEqual(200);
});

afterAll(async () => {
  await app.close();
});
