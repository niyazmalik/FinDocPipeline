import { Entity, Column, PrimaryGeneratedColumn, BeforeInsert, BeforeUpdate } from 'typeorm';
import * as crypto from 'crypto';

const ENC_KEY = process.env.TOKEN_ENCRYPTION_KEY || '32charslongsecretkey123456789012';

function encrypt(text: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENC_KEY), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decrypt(encrypted: string) {
  const [ivHex, enc] = encrypted.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENC_KEY),
    Buffer.from(ivHex, 'hex'),
  );
  let decrypted = decipher.update(enc, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  picture: string;

  @Column({ nullable: true })
  accessToken: string;

  @Column({ nullable: true })
  refreshToken: string;

  @Column({ nullable: true })
  scope: string;

  @Column({ nullable: true })
  tokenType: string;

  @Column({ nullable: true, type: 'bigint' })
  expiryDate: number | null;

  @BeforeInsert()
  @BeforeUpdate()
  encryptTokens() {
    if (this.accessToken) this.accessToken = encrypt(this.accessToken);
    if (this.refreshToken) this.refreshToken = encrypt(this.refreshToken);
  }

  decryptAccessToken() {
    return this.accessToken ? decrypt(this.accessToken) : null;
  }

  decryptRefreshToken() {
    return this.refreshToken ? decrypt(this.refreshToken) : null;
  }
}
