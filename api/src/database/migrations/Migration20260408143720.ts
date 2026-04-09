import { Migration } from '@mikro-orm/migrations';

export class Migration20260408143720 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table \`payments\` modify \`order_id\` varchar(64) not null default '', modify \`amount\` int not null default 0;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table \`payments\` modify \`order_id\` varchar(64) not null, modify \`amount\` int not null;`);
  }

}
