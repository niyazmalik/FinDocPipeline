import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1755850173178 implements MigrationInterface {
    name = 'InitSchema1755850173178'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "processed_emails" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "is_financial" boolean NOT NULL DEFAULT false, "processed_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "gemini_confidence_score" double precision, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "emailId" uuid, CONSTRAINT "PK_9be1fdd98a2f9ef340fa7909039" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "google_drive_files" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "file_id" character varying NOT NULL, "file_name" character varying NOT NULL, "file_url" character varying NOT NULL, "folder_id" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "emailId" uuid, CONSTRAINT "PK_72eec54f715f96df307d888120c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "google_sheets_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sheet_row_id" character varying NOT NULL, "record_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "emailId" uuid, "fileId" uuid, CONSTRAINT "PK_cb1398fa49c2a2a785cdff47899" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "emails" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "gmail_message_id" character varying NOT NULL, "sender" character varying NOT NULL, "subject" character varying NOT NULL, "body_snippet" text, "date_received" TIMESTAMP WITH TIME ZONE NOT NULL, "is_processed" boolean NOT NULL DEFAULT false, "google_label" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, CONSTRAINT "UQ_f1113b9176d41e5e14c20235e1b" UNIQUE ("gmail_message_id"), CONSTRAINT "PK_a54dcebef8d05dca7e839749571" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "processed_emails" ADD CONSTRAINT "FK_8673c01573c71a05058ec2b6450" FOREIGN KEY ("emailId") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "google_drive_files" ADD CONSTRAINT "FK_13fc08b61d9b909fb4bdddb31bb" FOREIGN KEY ("emailId") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "google_sheets_records" ADD CONSTRAINT "FK_c5c42b264f57d23ecd7aa363a7f" FOREIGN KEY ("emailId") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "google_sheets_records" ADD CONSTRAINT "FK_ce21c8f1484a4f60cfbf0fca297" FOREIGN KEY ("fileId") REFERENCES "google_drive_files"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "emails" ADD CONSTRAINT "FK_1c41bc3d329b0edc905b6409dba" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "emails" DROP CONSTRAINT "FK_1c41bc3d329b0edc905b6409dba"`);
        await queryRunner.query(`ALTER TABLE "google_sheets_records" DROP CONSTRAINT "FK_ce21c8f1484a4f60cfbf0fca297"`);
        await queryRunner.query(`ALTER TABLE "google_sheets_records" DROP CONSTRAINT "FK_c5c42b264f57d23ecd7aa363a7f"`);
        await queryRunner.query(`ALTER TABLE "google_drive_files" DROP CONSTRAINT "FK_13fc08b61d9b909fb4bdddb31bb"`);
        await queryRunner.query(`ALTER TABLE "processed_emails" DROP CONSTRAINT "FK_8673c01573c71a05058ec2b6450"`);
        await queryRunner.query(`DROP TABLE "emails"`);
        await queryRunner.query(`DROP TABLE "google_sheets_records"`);
        await queryRunner.query(`DROP TABLE "google_drive_files"`);
        await queryRunner.query(`DROP TABLE "processed_emails"`);
    }

}
