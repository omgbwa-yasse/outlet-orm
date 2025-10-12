const User = require('./User');

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
