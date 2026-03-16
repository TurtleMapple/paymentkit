import { initDatabase, orm } from './src/config/db';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

async function check() {
  try {
    console.log('Connecting to database...');
    const ormInstance = await initDatabase();
    console.log('Connected successfully!');
    
    console.log('Running migrations...');
    const migrator = ormInstance.getMigrator();
    await migrator.up();
    console.log('Migrations completed successfully!');
    
    await ormInstance.close();
  } catch (err) {
    console.error('Connection failed:');
    console.error(err);
    process.exit(1);
  }
}

check();
