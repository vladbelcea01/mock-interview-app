import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { isUniqueViolation } from '../common/pg-errors';
import { DbService } from '../db/db.service';
import { users } from '../db/schema';
import type { AuthUser, JwtPayload } from './auth-user';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface AuthResult {
  accessToken: string;
  user: AuthUser;
}

const BCRYPT_COST = 10;
// Compared against when the email is unknown so both failure paths take similar time.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', BCRYPT_COST);

@Injectable()
export class AuthService {
  constructor(
    private readonly dbService: DbService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    try {
      const [user] = await this.dbService.db
        .insert(users)
        .values({ email: dto.email, name: dto.name, passwordHash, role: 'INTERVIEWER' })
        .returning({ id: users.id, email: users.email, name: users.name, role: users.role });
      return this.issue(user);
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException('An account with this email already exists');
      throw err;
    }
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.dbService.db.query.users.findFirst({ where: eq(users.email, dto.email) });
    const valid = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) throw new UnauthorizedException('Invalid credentials');
    return this.issue({ id: user.id, email: user.email, name: user.name, role: user.role });
  }

  private issue(user: AuthUser): AuthResult {
    const payload: JwtPayload = { sub: user.id, email: user.email, name: user.name, role: user.role };
    return { accessToken: this.jwt.sign(payload), user };
  }
}
