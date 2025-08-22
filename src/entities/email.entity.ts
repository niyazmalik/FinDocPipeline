import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProcessedEmail } from './processed-email.entity';
import { GoogleDriveFile } from './google-drive-file.entity';
import { GoogleSheetsRecord } from './google-sheets-record.entity';
import { User } from './user.entity';

@Entity('emails')
export class Email {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ unique: true })
  gmail_message_id: string;

  @Column()
  sender: string;

  @Column()
  subject: string;

  @Column({ type: 'text', nullable: true })
  body_snippet: string;

  @Column({ type: 'timestamptz' })
  date_received: Date;

  @Column({ default: false })
  is_processed: boolean;

  @Column()
  google_label: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => ProcessedEmail, (processed) => processed.email)
  processedEmails: ProcessedEmail[];

  @OneToMany(() => GoogleDriveFile, (file) => file.email)
  driveFiles: GoogleDriveFile[];

  @OneToMany(() => GoogleSheetsRecord, (record) => record.email)
  sheetRecords: GoogleSheetsRecord[];
}
