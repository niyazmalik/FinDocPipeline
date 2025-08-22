import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { Email } from '../entities/email.entity';
import { ProcessedEmail } from '../entities/processed-email.entity';
import { GoogleDriveFile } from '../entities/google-drive-file.entity';
import { GoogleSheetsRecord } from '../entities/google-sheets-record.entity';
dotenv.config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [User, Email, ProcessedEmail, GoogleDriveFile, GoogleSheetsRecord],
  migrations: ['dist/database/migrations/*.js'],
  synchronize: false,
    ssl: {
    rejectUnauthorized: false,
  },
});
