import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { DbModule } from './db/db.module';
import { FeedbackModule } from './feedback/feedback.module';
import { HealthController } from './health/health.controller';
import { ParticipantsModule } from './participants/participants.module';
import { ReportsModule } from './reports/reports.module';
import { SearchModule } from './search/search.module';
import { SessionsModule } from './sessions/sessions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    DbModule,
    AuthModule,
    ParticipantsModule,
    SessionsModule,
    FeedbackModule,
    SearchModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: throttle first, then authenticate, then authorise.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
