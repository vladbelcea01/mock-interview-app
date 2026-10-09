import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpsertFeedbackDto } from './dto/upsert-feedback.dto';
import { FeedbackService } from './feedback.service';

@ApiTags('feedback')
@ApiBearerAuth()
@Controller('sessions/:id/feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Put()
  upsert(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpsertFeedbackDto, @CurrentUser() user: AuthUser) {
    return this.feedback.upsert(id, dto, user);
  }

  @Get()
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.feedback.get(id, user);
  }
}
