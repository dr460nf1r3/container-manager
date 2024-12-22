import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Provide the OpenAPI documentation, either as a route via Swagger or as a JSON file.
 * @param app The Nest instance to provide the Swagger UI for.
 * @param writeToDisk Whether to write the OpenAPI JSON to disk or not.
 */
export async function provideSwagger(app: INestApplication, writeToDisk: boolean): Promise<void> {
  const config = new DocumentBuilder()
    .setLicense('AGPL-3.0', "https://www.gnu.org/licenses/agpl-3.0'")
    .setTitle('Container Manager API')
    .setDescription('Container Manager API specification')
    .setVersion('1.0')
    .setContact('Nico Jensch', 'https://github.com/dr460nf1r3', 'container-manager@dr460nf1r3.org')
    .build();

  const documentFactory = (): OpenAPIObject => SwaggerModule.createDocument(app, config);

  // If the environment variable SWAGGER_JSON is not set, write the swagger.json file to disk and close the app.
  if (writeToDisk) {
    await writeOpenApiJson(app, documentFactory);
  } else {
    SwaggerModule.setup('api', app, documentFactory);
  }
}

/*
 * Write the OpenAPI JSON to disk and close the app with a successful exit code.
 */
async function writeOpenApiJson(app: INestApplication, documentFactory: () => OpenAPIObject): Promise<void> {
  const targetPath: string = join(process.cwd(), 'docs');
  if (!existsSync(targetPath)) mkdirSync(targetPath, { recursive: true });

  const outputPath: string = resolve(process.cwd(), 'docs', 'swagger.json');
  writeFileSync(outputPath, JSON.stringify(documentFactory()), { encoding: 'utf8' });

  await app.close();
  process.exit(0);
}
