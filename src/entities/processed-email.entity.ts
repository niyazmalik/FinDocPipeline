import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Email } from "./email.entity";

@Entity('processed_emails')
export class ProcessedEmail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Email, (email) => email.processedEmails, { onDelete: 'CASCADE' })
  email: Email;

  @Column({ default: false })
  is_financial: boolean;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  processed_date: Date;

  @Column({ type: 'float', nullable: true })
  gemini_confidence_score: number;

  @CreateDateColumn()
  created_at: Date;
}
