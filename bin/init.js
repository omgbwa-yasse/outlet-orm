#!/usr/bin/env node

/**
 * Script d'initialisation pour le package ORM
 * Ce script aide à configurer rapidement un projet avec l'ORM
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function init() {
  console.log('\n🚀 Bienvenue dans l\'assistant de configuration Outlet ORM!\n');

  try {
    // Database driver
    console.log('Quel driver de base de données souhaitez-vous utiliser?');
    console.log('1. MySQL');
    console.log('2. PostgreSQL');
    console.log('3. SQLite');
    const driverChoice = await question('\nVotre choix (1-3): ');

    const drivers = {
      '1': { name: 'mysql', package: 'mysql2', defaultPort: 3306 },
      '2': { name: 'postgres', package: 'pg', defaultPort: 5432 },
      '3': { name: 'sqlite', package: 'sqlite3', defaultPort: null }
    };

    const selectedDriver = drivers[driverChoice];
    if (!selectedDriver) {
      console.error('❌ Choix invalide!');
      process.exit(1);
    }

    // Database configuration
    let config = {
      driver: selectedDriver.name
    };

    if (selectedDriver.name !== 'sqlite') {
      config.host = await question('Host (localhost): ') || 'localhost';
      config.port = await question(`Port (${selectedDriver.defaultPort}): `) || selectedDriver.defaultPort;
      config.database = await question('Nom de la base de données: ');
      config.user = await question('Utilisateur: ');
      config.password = await question('Mot de passe: ');
    } else {
      config.database = await question('Chemin du fichier SQLite (./database.sqlite): ') || './database.sqlite';
    }

    // Ask to generate a .env file
    const generateEnv = (await question('\nSouhaitez-vous générer un fichier .env avec ces paramètres ? (oui/non) [oui]: ')).trim().toLowerCase();
    const wantEnv = generateEnv === '' || generateEnv === 'oui' || generateEnv === 'o' || generateEnv === 'yes' || generateEnv === 'y';

    if (wantEnv) {
      const envLines = [];
      envLines.push(`DB_DRIVER=${config.driver}`);
      if (config.driver !== 'sqlite') {
        envLines.push(`DB_HOST=${config.host || 'localhost'}`);
        envLines.push(`DB_PORT=${config.port || selectedDriver.defaultPort || ''}`);
        envLines.push(`DB_USER=${config.user || ''}`);
        envLines.push(`DB_PASSWORD=${config.password || ''}`);
        envLines.push(`DB_DATABASE=${config.database || ''}`);
      } else {
        envLines.push(`DB_FILE=${config.database}`);
      }

      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        console.log('ℹ️  .env existe déjà, génération ignorée.');
      } else {
        fs.writeFileSync(envPath, envLines.join('\n') + '\n');
        console.log(`✅ Fichier .env créé: ${envPath}`);
      }
    }

    // Generate config file
    const configContent = `const { DatabaseConnection } = require('outlet-orm');

// Configuration de la base de données
const db = new DatabaseConnection(${JSON.stringify(config, null, 2)});

module.exports = db;
`;

    const configPath = path.join(process.cwd(), 'database.js');
    fs.writeFileSync(configPath, configContent);
    console.log(`\n✅ Fichier de configuration créé: ${configPath}`);

    // Create project structure directories
    const directories = [
      'config',
      'database',
      'database/migrations',
      'database/seeds',
      'models',
      'controllers',
      'routes',
      'middlewares',
      'services',
      'utils',
      'validators',
      'public',
      'public/images',
      'public/css',
      'public/js',
      'uploads',
      'logs',
      'src',
      'tests'
    ];

    console.log('\n📁 Création de la structure de projet...');
    for (const dir of directories) {
      const dirPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`  ✅ ${dir}/`);
      } else {
        console.log(`  ⏭️  ${dir}/ (existe déjà)`);
      }
    }

    const databaseSeederPath = path.join(process.cwd(), 'database', 'seeds', 'DatabaseSeeder.js');
    if (!fs.existsSync(databaseSeederPath)) {
      const databaseSeederContent = `const { Seeder } = require('outlet-orm');

class DatabaseSeeder extends Seeder {
  async run() {
    // Example:
    // await this.call('UserSeeder');
  }
}

module.exports = DatabaseSeeder;
`;
      fs.writeFileSync(databaseSeederPath, databaseSeederContent);
      console.log('✅ database/seeds/DatabaseSeeder.js créé');
    }

    // Generate .gitignore
    const gitignoreContent = `# Secrets
.env
.env.local
.env.production

# Logs
logs/
*.log

# Uploads
uploads/

# Dependencies
node_modules/

# Build
dist/
build/

# IDE
.vscode/
.idea/
`;

    const gitignorePath = path.join(process.cwd(), '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, gitignoreContent);
      console.log(`\n✅ .gitignore créé`);
    }

    // Generate .env.example
    const envExampleContent = `# Base de données
DB_DRIVER=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=myapp
DB_USER=your_user
DB_PASSWORD=your_password

# Sécurité
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=15m

# Application
NODE_ENV=development
PORT=3000

# CORS
CORS_ORIGIN=http://localhost:3000
`;

    const envExamplePath = path.join(process.cwd(), '.env.example');
    if (!fs.existsSync(envExamplePath)) {
      fs.writeFileSync(envExamplePath, envExampleContent);
      console.log(`✅ .env.example créé`);
    }

    // Generate config/security.js
    const securityConfigContent = `/**
 * Configuration de sécurité
 * npm install helmet express-rate-limit xss-clean hpp
 */

module.exports = {
  // Rate limiting (100 requêtes/15min par IP)
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Trop de requêtes, réessayez plus tard' }
  },

  // Rate limiting strict pour auth (5 tentatives/15min)
  authRateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Trop de tentatives de connexion' }
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m'
  }
};
`;

    const securityConfigPath = path.join(process.cwd(), 'config', 'security.js');
    if (!fs.existsSync(securityConfigPath)) {
      fs.writeFileSync(securityConfigPath, securityConfigContent);
      console.log(`✅ config/security.js créé`);
    }

    // Generate middlewares/errorHandler.js
    const errorHandlerContent = `/**
 * Gestionnaire d'erreurs centralisé
 */
const errorHandler = (err, req, res, next) => {
  console.error(\`[\${new Date().toISOString()}] Error:\`, err);

  const isDev = process.env.NODE_ENV === 'development';

  res.status(err.status || 500).json({
    error: isDev ? err.message : 'Erreur serveur',
    stack: isDev ? err.stack : undefined
  });
};

module.exports = errorHandler;
`;

    const errorHandlerPath = path.join(process.cwd(), 'middlewares', 'errorHandler.js');
    if (!fs.existsSync(errorHandlerPath)) {
      fs.writeFileSync(errorHandlerPath, errorHandlerContent);
      console.log(`✅ middlewares/errorHandler.js créé`);
    }

    // Generate utils/hash.js
    const hashUtilContent = `/**
 * Utilitaires de hachage
 * npm install bcrypt
 */
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

const verifyPassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

module.exports = { hashPassword, verifyPassword };
`;

    const hashUtilPath = path.join(process.cwd(), 'utils', 'hash.js');
    if (!fs.existsSync(hashUtilPath)) {
      fs.writeFileSync(hashUtilPath, hashUtilContent);
      console.log(`✅ utils/hash.js créé`);
    }

    // Generate example model
    const modelContent = `const { Model } = require('outlet-orm');
const db = require('./database');

class User extends Model {
  static table = 'users';
  static fillable = ['name', 'email', 'password'];
  static hidden = ['password', 'refresh_token']; // 🔒 Ne jamais exposer
  static casts = {
    id: 'int',
    email_verified: 'boolean'
  };
  static rules = {
    name: 'required|string|min:2|max:100',
    email: 'required|email',
    password: 'required|min:8'
  };
  static connection = db;

  // Définissez vos relations ici
  // posts() {
  //   return this.hasMany(Post, 'user_id');
  // }
}

module.exports = User;
`;

    const modelPath = path.join(process.cwd(), 'User.js');
    fs.writeFileSync(modelPath, modelContent);
    console.log(`✅ Modèle exemple créé: ${modelPath}`);

    // Generate usage example
    const usageContent = `const User = require('./User');

async function main() {
  try {
    // Exemple: Créer un utilisateur
    const user = await User.create({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'secret123'
    });
    console.log('Utilisateur créé:', user.toJSON());

    // Exemple: Rechercher des utilisateurs
    const users = await User.all();
    console.log('Tous les utilisateurs:', users.length);

    // Exemple: Requête avec conditions
    const activeUsers = await User
      .where('status', 'active')
      .orderBy('name')
      .get();
    console.log('Utilisateurs actifs:', activeUsers.length);

  } catch (error) {
    console.error('Erreur:', error.message);
  }
}

main();
`;

    const usagePath = path.join(process.cwd(), 'example.js');
    fs.writeFileSync(usagePath, usageContent);
    console.log(`✅ Exemple d'utilisation créé: ${usagePath}`);

    // Optionally skip package init/install in non-interactive or test context
    const skipInstall = process.env.OUTLET_INIT_NO_INSTALL === '1';
    if (!skipInstall) {
      // Check if package needs to be installed
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        console.log('\n⚠️  Aucun package.json trouvé. Initialisation...');
        require('child_process').execSync('npm init -y', { stdio: 'inherit' });
      }

      console.log(`\n📦 Installation du driver ${selectedDriver.package}...`);
      require('child_process').execSync(`npm install ${selectedDriver.package}`, { stdio: 'inherit' });
    } else {
      console.log('\n⏭️  Installation du driver ignorée (OUTLET_INIT_NO_INSTALL=1).');
    }

    console.log('\n✨ Configuration terminée!\n');
    console.log('Prochaines étapes:');
    console.log('1. Créez votre schéma de base de données');
    console.log('2. Modifiez User.js selon vos besoins');
    console.log('3. Exécutez example.js: node example.js');
    console.log('\n📚 Documentation: https://github.com/yourusername/outlet-orm');

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

init();
