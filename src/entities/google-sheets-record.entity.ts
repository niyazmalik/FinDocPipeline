import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Email } from './email.entity';
import { GoogleDriveFile } from './google-drive-file.entity';

@Entity('google_sheets_records')
export class GoogleSheetsRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sheet_row_id: string;

  @ManyToOne(() => Email, (email) => email.sheetRecords, { onDelete: 'CASCADE' })
  email: Email;

  @ManyToOne(() => GoogleDriveFile, { nullable: true, onDelete: 'SET NULL' })
  file: GoogleDriveFile;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  record_date: Date;

  @CreateDateColumn()
  created_at: Date;
}
