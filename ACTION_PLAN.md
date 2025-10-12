# Outlet ORM – Plan d'action des relations et filtres avancés

Dernière mise à jour: 2025-10-12

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
- [x] with avec contraintes: with({ rel: qb => qb.where(...) }) et dot-notation de base

## Phase 2 – Relations transitives

- [~] hasManyThrough
- [ ] hasOneThrough (optionnel)

## Phase 3 – Relations polymorphiques

- [ ] morphTo / morphOne / morphMany
- [ ] Morph Map (Model.setMorphMap)

## Phase 4 – belongsToMany avancé (pivot)

- [ ] withPivot(...cols) + exposition model.pivot
- [ ] wherePivot / wherePivotIn
- [ ] withTimestamps sur pivot
- [ ] as('alias') pour renommer pivot
- [ ] toggle(ids) / syncWithoutDetaching(ids)
- [ ] updateExistingPivot(id, attrs)

## Phase 5 – Ergonomie belongsTo et création via relations

- [ ] belongsTo.withDefault(val|fn)
- [ ] belongsTo.associate(modelOrId) / dissociate()
- [ ] hasOne/hasMany: create/save/createMany/saveMany
- [ ] belongsToMany: create + attach, createMany

## Phase 6 – Divers

- [ ] touches (timestamps parent) – au moins pour belongsTo
- [ ] Améliorer withCount pour belongsToMany et contraintes

## Notes techniques

- whereHas/has/whereDoesntHave utilisent des JOINs. Pour la sémantique stricte EXISTS/NOT EXISTS, une itération future pourra ajouter des sous-requêtes spécifiques selon le driver.
- withCount Phase 1 couvre hasOne/hasMany/belongsTo via sous-requêtes simples.

## Validation

- Lint: PASS (à revalider à chaque étape)
- Tests: PASS existants; des tests additionnels seront ajoutés au fil des features.
