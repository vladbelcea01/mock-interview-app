import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength } from 'class-validator';
import { NormalizeEmail } from '../../common/transforms';

export class LoginDto {
  @ApiProperty({ example: 'interviewer@demo.dev' })
  @NormalizeEmail()
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Demo123!' })
  @IsString()
  @MaxLength(72)
  password!: string;
}
