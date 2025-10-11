/**
 * Exemple d'utilisation des modèles générés avec relations automatiques
 *
 * Ce fichier démontre comment utiliser les modèles ORM générés automatiquement
 * avec toutes leurs relations détectées.
 */

const { DatabaseConnection, Model } = require('outlet-orm');

// Configuration de la base de données
const db = new DatabaseConnection({
  driver: 'mysql',
  host: 'localhost',
  database: 'blog_db',
  user: 'root',
  password: 'secret',
  port: 3306
});

Model.setConnection(db);

// ==================== Importer les modèles générés ====================
const User = require('./models/User');
const Role = require('./models/Role');
const Profile = require('./models/Profile');
const Post = require('./models/Post');
const Category = require('./models/Category');
const Comment = require('./models/Comment');
const Tag = require('./models/Tag');

// ==================== Exemples d'utilisation ====================

async function examples() {
  try {
    await db.connect();
    console.log('✅ Connecté à la base de données\n');

    // ==================== 1. Relations belongsTo ====================
    console.log('📌 1. Relations belongsTo (Appartient à)\n');

    // Récupérer un article avec son auteur
    const post = await Post.find(1);
    const author = await post.user(); // belongsTo
    console.log(`Article: "${post.getAttribute('title')}"`);
    console.log(`Auteur: ${author.getAttribute('name')}\n`);

    // Récupérer un profil avec son utilisateur
    const profile = await Profile.find(1);
    const profileUser = await profile.user(); // belongsTo
    console.log(`Profil: ${profile.getAttribute('bio')}`);
    console.log(`Utilisateur: ${profileUser.getAttribute('name')}\n`);

    // ==================== 2. Relations hasMany ====================
    console.log('📌 2. Relations hasMany (A plusieurs)\n');

    // Récupérer un utilisateur avec tous ses articles
    const user = await User.find(1);
    const userPosts = await user.posts(); // hasMany (généré automatiquement!)
    console.log(`Utilisateur: ${user.getAttribute('name')}`);
    console.log(`Nombre d'articles: ${userPosts.length}`);
    userPosts.forEach(p => {
      console.log(`  - ${p.getAttribute('title')}`);
    });
    console.log('');

    // Récupérer une catégorie avec tous ses articles
    const category = await Category.find(1);
    const categoryPosts = await category.posts(); // hasMany (généré automatiquement!)
    console.log(`Catégorie: ${category.getAttribute('name')}`);
    console.log(`Nombre d'articles: ${categoryPosts.length}\n`);

    // ==================== 3. Relations hasOne ====================
    console.log('📌 3. Relations hasOne (A un seul)\n');

    // Récupérer un utilisateur avec son profil unique
    const userWithProfile = await User.find(1);
    const userProfile = await userWithProfile.profile(); // hasOne (détecté via UNIQUE!)
    console.log(`Utilisateur: ${userWithProfile.getAttribute('name')}`);
    console.log(`Bio: ${userProfile.getAttribute('bio')}`);
    console.log(`Site web: ${userProfile.getAttribute('website')}\n`);

    // ==================== 4. Relations belongsToMany ====================
    console.log('📌 4. Relations belongsToMany (Plusieurs à plusieurs)\n');

    // Récupérer un article avec tous ses tags
    const postWithTags = await Post.find(1);
    const tags = await postWithTags.tags(); // belongsToMany (détecté via table pivot!)
    console.log(`Article: "${postWithTags.getAttribute('title')}"`);
    console.log(`Tags:`);
    tags.forEach(tag => {
      console.log(`  - ${tag.getAttribute('name')}`);
    });
    console.log('');

    // Récupérer un tag avec tous ses articles
    const tag = await Tag.find(1);
    const tagPosts = await tag.posts(); // belongsToMany (détecté automatiquement!)
    console.log(`Tag: ${tag.getAttribute('name')}`);
    console.log(`Articles associés: ${tagPosts.length}\n`);

    // ==================== 5. Relations récursives ====================
    console.log('📌 5. Relations récursives (Auto-relations)\n');

    // Catégorie avec sous-catégories
    const parentCategory = await Category.find(1);
    const subCategories = await parentCategory.categories(); // hasMany vers soi-même
    console.log(`Catégorie: ${parentCategory.getAttribute('name')}`);
    console.log(`Sous-catégories:`);
    subCategories.forEach(sub => {
      console.log(`  - ${sub.getAttribute('name')}`);
    });
    console.log('');

    // Sous-catégorie avec sa catégorie parent
    const subCategory = await Category.find(5);
    const parent = await subCategory.parent(); // belongsTo vers soi-même
    console.log(`Sous-catégorie: ${subCategory.getAttribute('name')}`);
    console.log(`Catégorie parent: ${parent.getAttribute('name')}\n`);

    // Commentaire avec réponses
    const comment = await Comment.find(1);
    const replies = await comment.comments(); // hasMany vers soi-même
    console.log(`Commentaire: "${comment.getAttribute('content').substring(0, 50)}..."`);
    console.log(`Nombre de réponses: ${replies.length}\n`);

    // ==================== 6. Eager Loading (Chargement anticipé) ====================
    console.log('📌 6. Eager Loading (Chargement anticipé)\n');

    // Charger plusieurs articles avec leurs relations
    const postsWithRelations = await Post
      .with('user', 'category', 'tags', 'comments')
      .limit(5)
      .get();

    console.log(`Chargé ${postsWithRelations.length} articles avec toutes leurs relations:`);
    postsWithRelations.forEach(p => {
      console.log(`\nArticle: "${p.getAttribute('title')}"`);
      console.log(`  Auteur: ${p.relations.user?.getAttribute('name')}`);
      console.log(`  Catégorie: ${p.relations.category?.getAttribute('name')}`);
      console.log(`  Tags: ${p.relations.tags?.length || 0}`);
      console.log(`  Commentaires: ${p.relations.comments?.length || 0}`);
    });
    console.log('');

    // ==================== 7. Utilisation combinée ====================
    console.log('📌 7. Utilisation combinée\n');

    // Trouver un utilisateur et afficher toutes ses données liées
    const fullUser = await User
      .with('role', 'profile', 'posts', 'comments')
      .find(1);

    console.log(`=== Profil complet de ${fullUser.getAttribute('name')} ===`);
    console.log(`Email: ${fullUser.getAttribute('email')}`);
    console.log(`Rôle: ${fullUser.relations.role?.getAttribute('name')}`);
    console.log(`Bio: ${fullUser.relations.profile?.getAttribute('bio')}`);
    console.log(`Articles publiés: ${fullUser.relations.posts?.length || 0}`);
    console.log(`Commentaires: ${fullUser.relations.comments?.length || 0}\n`);

    // ==================== 8. Manipulation des relations many-to-many ====================
    console.log('📌 8. Manipulation des relations many-to-many\n');

    // Attacher des tags à un article
    const newPost = await Post.find(10);
    const postTags = await newPost.tags();

    // Attacher un nouveau tag
    await postTags.attach(3); // Attacher le tag ID 3
    console.log('✅ Tag attaché à l\'article');

    // Attacher plusieurs tags
    await postTags.attach([4, 5, 6]);
    console.log('✅ Plusieurs tags attachés');

    // Synchroniser les tags (remplace tous les tags existants)
    await postTags.sync([1, 2, 3]);
    console.log('✅ Tags synchronisés');

    // Détacher un tag
    await postTags.detach(2);
    console.log('✅ Tag détaché\n');

    // ==================== 9. Requêtes conditionnelles sur relations ====================
    console.log('📌 9. Requêtes conditionnelles sur relations\n');

    // Trouver tous les utilisateurs qui ont au moins un article publié
    const activeAuthors = await User.query()
      .whereHas('posts', query => {
        query.where('status', 'published');
      })
      .get();
    console.log(`Auteurs actifs: ${activeAuthors.length}\n`);

    // ==================== 10. Comptage des relations ====================
    console.log('📌 10. Comptage des relations\n');

    // Compter les articles d'une catégorie sans les charger
    const categoryWithCount = await Category.find(1);
    const postsCount = await categoryWithCount.posts().count();
    console.log(`Catégorie "${categoryWithCount.getAttribute('name')}" a ${postsCount} articles`);

    // Compter les commentaires d'un article
    const postWithCount = await Post.find(1);
    const commentsCount = await postWithCount.comments().count();
    console.log(`Article "${postWithCount.getAttribute('title')}" a ${commentsCount} commentaires\n`);

    console.log('✅ Tous les exemples terminés!');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
  } finally {
    await db.close();
  }
}

// Exécuter les exemples
if (require.main === module) {
  examples();
}

module.exports = { examples };
