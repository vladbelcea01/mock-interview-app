import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/http-exception.filter';

/** Shared by main.ts and the e2e tests so tests run with the production setup. */
export function configureApp(app: INestApplication): void {
  // Behind Azure's ingress proxy: trust the first X-Forwarded-For hop so rate limiting sees the real client IP.
  (app as NestExpressApplication).set('trust proxy', 1);
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Mock Interview API')
    .setDescription('Interview sessions, participants, feedback, search and reports')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
}
