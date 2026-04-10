import { Migration } from '@mikro-orm/migrations';

export class Migration20260210035521 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table \`payments\` (\`id\` varchar(36) not null, \`order_id\` varchar(128) not null, \`amount\` int not null, \`status\` varchar(32) not null default 'PENDING', \`payment_type\` varchar(32) null, \`bank\` varchar(32) null, \`va_number\` varchar(64) null, \`expired_at\` datetime null, \`paid_at\` datetime null, \`gateway\` varchar(32) not null default 'midtrans', \`gateway_response\` json null, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`deleted_at\` datetime null, \`payment_link\` varchar(255) null, \`payment_link_created_at\` datetime null, \`payment_attempt_count\` int not null default 0, \`customer_name\` varchar(128) null, \`customer_email\` varchar(128) null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`payments\` add unique \`payments_order_id_unique\`(\`order_id\`);`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists \`payments\`;`);
  }
}
