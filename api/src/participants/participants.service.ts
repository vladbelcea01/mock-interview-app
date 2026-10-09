import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { asc, count, eq, ilike, or, SQL } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth-user';
import { definedOnly, offsetOf, Paginated } from '../common/pagination.dto';
import { escapeLike, isUniqueViolation } from '../common/pg-errors';
import { DbService } from '../db/db.service';
import { Participant, participants } from '../db/schema';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { QueryParticipantsDto } from './dto/query-participants.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';

const DUPLICATE_MESSAGE = 'A participant with this email already exists';

/** Participants are a shared directory: every authenticated user can see and edit them. */
@Injectable()
export class ParticipantsService {
  constructor(private readonly dbService: DbService) {}

  private get db() {
    return this.dbService.db;
  }

  async findAll(query: QueryParticipantsDto): Promise<Paginated<Participant>> {
    let where: SQL | undefined;
    if (query.q) {
      const pattern = `%${escapeLike(query.q)}%`;
      where = or(ilike(participants.fullName, pattern), ilike(participants.email, pattern));
    }
    const [items, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(participants)
        .where(where)
        .orderBy(asc(participants.fullName))
        .limit(query.pageSize)
        .offset(offsetOf(query)),
      this.db.select({ total: count() }).from(participants).where(where),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async findOne(id: string): Promise<Participant> {
    const participant = await this.db.query.participants.findFirst({ where: eq(participants.id, id) });
    if (!participant) throw new NotFoundException('Participant not found');
    return participant;
  }

  async create(dto: CreateParticipantDto, user: AuthUser): Promise<Participant> {
    try {
      const [created] = await this.db
        .insert(participants)
        .values({ ...dto, createdById: user.id })
        .returning();
      return created;
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException(DUPLICATE_MESSAGE);
      throw err;
    }
  }

  async update(id: string, dto: UpdateParticipantDto): Promise<Participant> {
    const existing = await this.findOne(id);
    const changes = definedOnly(dto);
    if (Object.keys(changes).length === 0) return existing;
    try {
      const [updated] = await this.db.update(participants).set(changes).where(eq(participants.id, id)).returning();
      return updated;
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException(DUPLICATE_MESSAGE);
      throw err;
    }
  }
}
