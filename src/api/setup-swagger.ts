import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export function provideSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setLicense('AGPL-3.0', "https://www.gnu.org/licenses/agpl-3.0'")
    .setTitle('Container Manager API')
    .setDescription('Container Manager API specification')
    .setVersion('1.0')
    .setContact('Nico Jensch', 'https://github.com/dr460nf1r3', 'container-manager@dr460nf1r3.org')
    .build();
  const documentFactory = (): OpenAPIObject => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);
}
