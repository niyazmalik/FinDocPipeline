import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Email } from './email.entity';

@Entity('google_drive_files')
export class GoogleDriveFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  file_id: string;

  @Column()
  file_name: string;

  @Column()
  file_url: string;

  @Column({ nullable: true })
  folder_id: string;

  @ManyToOne(() => Email, (email) => email.driveFiles, { onDelete: 'CASCADE' })
  email: Email;

  @CreateDateColumn()
  created_at: Date;
}
