import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1755859478389 implements MigrationInterface {
    name = 'InitSchema1755859478389'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "emails" ALTER COLUMN "google_label" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "emails" ALTER COLUMN "google_label" DROP NOT NULL`);
    }

}
