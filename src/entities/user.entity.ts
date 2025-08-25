import { Entity, Column, PrimaryGeneratedColumn, BeforeInsert, BeforeUpdate } from 'typeorm';
import { encrypt, decrypt } from '../common/helpers/token-encryption.helper';

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
