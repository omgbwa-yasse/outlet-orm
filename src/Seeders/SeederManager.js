const fs = require('fs').promises;
const path = require('path');

class SeederManager {
  constructor(connection, seedsPath = './database/seeds') {
    this.connection = connection;
    this.seedsPath = path.resolve(process.cwd(), seedsPath);
  }

  async run(target = null) {
    const files = await this.getSeederFiles();

    if (files.length === 0) {
      console.log('No seeders found');
      return;
    }

    const toRun = this.filterTargetSeeders(files, target);

    if (toRun.length === 0) {
      throw new Error(`Seeder not found: ${target}`);
    }

    console.log(`Running ${toRun.length} seeder(s)...\n`);

    for (const file of toRun) {
      await this.runSeeder(file);
    }

    console.log('\nSeeding completed successfully');
  }

  filterTargetSeeders(files, target) {
    if (!target) {
      const databaseSeeder = files.find(file => file.toLowerCase() === 'databaseseeder.js');
      return databaseSeeder ? [databaseSeeder] : files;
    }

    const normalizedTarget = String(target).toLowerCase();

    return files.filter((file) => {
      const base = path.basename(file, '.js').toLowerCase();
      return file.toLowerCase() === normalizedTarget
        || base === normalizedTarget
        || `${base}.js` === normalizedTarget;
    });
  }

  async runSeeder(seederRef) {
    const seederPath = this.resolveSeederPath(seederRef);

    try {
      delete require.cache[require.resolve(seederPath)];
      const ExportedSeeder = require(seederPath);
      const SeederClass = ExportedSeeder?.default || ExportedSeeder;

      if (typeof SeederClass !== 'function') {
        throw new Error('Seeder module must export a class');
      }

      const seeder = new SeederClass(this.connection, this);

      if (typeof seeder.run !== 'function') {
        throw new Error('Seeder class must implement run()');
      }

      await seeder.run();
      console.log(`${path.basename(seederPath)}`);
    } catch (error) {
      console.error(`Failed to run seeder: ${path.basename(seederPath)}`);
      console.error(error.message);
      throw error;
    }
  }

  resolveSeederPath(seederRef) {
    if (typeof seederRef !== 'string') {
      throw new Error('Seeder reference must be a file path or filename string');
    }

    if (path.isAbsolute(seederRef)) {
      return seederRef;
    }

    const hasExt = path.extname(seederRef) === '.js';
    const fileName = hasExt ? seederRef : `${seederRef}.js`;
    return path.join(this.seedsPath, fileName);
  }

  async getSeederFiles() {
    try {
      const files = await fs.readdir(this.seedsPath);
      return files
        .filter(file => file.endsWith('.js'))
        .sort();
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
}

module.exports = SeederManager;
