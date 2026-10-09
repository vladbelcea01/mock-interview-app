import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateSessionDto } from './dto/create-session.dto';
import { QuerySessionsDto } from './dto/query-sessions.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { SessionsService } from './sessions.service';

@ApiTags('sessions')
@ApiBearerAuth()
@Controller()
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get('sessions')
  findAll(@Query() query: QuerySessionsDto, @CurrentUser() user: AuthUser) {
    return this.sessions.findAll(query, user);
  }

  @Get('sessions/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.sessions.getDetail(id, user);
  }

  @Post('sessions')
  create(@Body() dto: CreateSessionDto, @CurrentUser() user: AuthUser) {
    return this.sessions.create(dto, user);
  }

  @Patch('sessions/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSessionDto, @CurrentUser() user: AuthUser) {
    return this.sessions.update(id, dto, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('sessions/:id/complete')
  complete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.sessions.complete(id, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('sessions/:id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.sessions.cancel(id, user);
  }

  @Get('participants/:id/sessions')
  byParticipant(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.sessions.findByParticipant(id, user);
  }
}
