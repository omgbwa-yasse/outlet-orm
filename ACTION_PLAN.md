# Outlet ORM – Plan d'action des relations et filtres avancés

Dernière mise à jour: 2025-01-11

Ce document suit l'avancement des fonctionnalités relationnelles avancées alignées avec Eloquent.

## Légende

- [ ] À faire
- [~] En cours
- [x] Terminé

## Phase 1 – Filtres relationnels et charges contrôlées

- [x] whereHas(relation, callback)
- [x] with(...relations) simple
- [x] distinct() sur QueryBuilder et rendu SQL
- [x] Support groupBy/having dans le SELECT builder
- [x] has(relation, op, count) – via JOIN + GROUP BY + HAVING
- [x] whereDoesntHave(relation) – via LEFT JOIN + WHERE related.pk IS NULL (sans callback pour l’instant)
- [x] withCount('rel' | ['relA', 'relB']) – sous-requêtes COUNT(*) simples (sans callback)
- [x] with avec contraintes: with({ rel: qb => qb.where(...) }) et dot-notation complète pour relations imbriquées

## Phase 2 – Relations transitives

- [x] hasManyThrough
- [x] hasOneThrough

## Phase 3 – Relations polymorphiques

- [x] morphTo / morphOne / morphMany
- [x] Morph Map (Model.setMorphMap)

## Phase 4 – belongsToMany avancé (pivot)

- [x] withPivot(...cols) + exposition model.pivot
- [x] wherePivot / wherePivotIn
- [x] withTimestamps sur pivot
- [x] as('alias') pour renommer pivot
- [x] toggle(ids) / syncWithoutDetaching(ids)
- [x] updateExistingPivot(id, attrs)

## Phase 5 – Ergonomie belongsTo et création via relations

- [x] belongsTo.withDefault(val|fn)
- [x] belongsTo.associate(modelOrId) / dissociate()
- [x] hasOne/hasMany: create/save/createMany/saveMany
- [x] belongsToMany: create + attach, createMany

## Phase 6 – Divers

- [x] touches (timestamps parent) – au moins pour belongsTo
- [x] Améliorer withCount pour belongsToMany et contraintes

## Notes techniques

- whereHas/has/whereDoesntHave utilisent des JOINs. Pour la sémantique stricte EXISTS/NOT EXISTS, une itération future pourra ajouter des sous-requêtes spécifiques selon le driver.
- withCount Phase 1 couvre hasOne/hasMany/belongsTo via sous-requêtes simples.
- Chargement eager imbriqué maintenant supporté avec dot-notation (ex: `with('posts.comments.author')`), générant des structures JSON imbriquées comme demandé.

## Validation

- Lint: PASS (à revalider à chaque étape)
- Tests: PASS existants; des tests additionnels seront ajoutés au fil des features.
- Demo: examples/polymorphic-demo.js montre les relations polymorphiques avec eager loading.
