# API Import Reference (Outlet ORM)

## Objectif

Ce document sert de référence pour l'import automatique des modèles API (et relations) à partir d'une documentation d'API.

## Commande actuelle (existant)

La commande disponible aujourd'hui est :

```bash
npx outlet-api-import (--spec|--doc) <path|url> --output <dir> [--lang js|ts] [--auth bearer|basic|apiKey|oauth2] [--strategy tag|resource] [--format auto|openapi|postman|raml|apiblueprint|graphql] [--max-depth n] [--include-official-subdomains true|false] [--run-delta]
```

Exemple :

```bash
npx outlet-api-import --doc https://api.exemple.com/swagger --output ./models --lang js --strategy tag
```

## Exécution incrémentale (run delta)

Quand l'option `--run-delta` est activée avec une source `--doc`, l'outil produit aussi des artefacts d'exécution pour comparer deux imports successifs.

Artefacts générés dans `--output`:

- `_coverage-report.json`: métriques de couverture, diagnostics, pages traitées/ignorées/en erreur, conflits.
- `_run-state.json`: état du dernier run (snapshot + digest) utilisé comme base de comparaison.
- `_run-delta.json`: différences entre le run précédent et le run courant (opérations ajoutées/supprimées, delta de couverture).

Exemple:

```bash
# Premier run
npx outlet-api-import --doc https://api.exemple.com/docs --output ./models --run-delta

# Run suivant après mise à jour de la documentation
npx outlet-api-import --doc https://api.exemple.com/docs --output ./models --run-delta
```

## Paramètres de crawl documentation

- `--max-depth`: profondeur maximale de découverte des pages officielles depuis la racine de doc (par défaut: `4`).
- `--include-official-subdomains`: inclut les sous-domaines officiels détectés (`true` par défaut).

## Compatibilité des documentations API

### Prise en charge actuelle

- OpenAPI 3.x en JSON (fichier local ou URL directe) : Oui
- Swagger 2.0 en JSON (fichier local ou URL directe) : Oui
- OpenAPI YAML (`.yaml`/`.yml`) : Oui
- URL de page Swagger UI HTML (`/swagger`, `/docs`) : Oui (détection URL spec + fallback endpoint)
- Postman Collection v2.x : Oui (avec support auth, body modes, responses exemples)
- RAML 1.0 : Oui (ressources imbriquées, méthodes, paramètres, bodies, responses)
- API Blueprint : Oui (Group/Resource/Action + responses)
- GraphQL introspection JSON : Oui (queries, mutations, types objets/interfaces/unions)

### Couverture avancée (variations complexes)

- OpenAPI natif :
	- Composition/polymorphisme (`allOf`/`oneOf`/`anyOf`) : Préservé quand source OpenAPI.
	- Discriminator : Préservé quand source OpenAPI.
	- Security schemes et requirements : Préservés quand source OpenAPI.
	- Multi-document refs/cycles : Partiel (résolution dépend de la spec source déjà résolue).
	- Callbacks/Webhooks/Links : Préservés au niveau spec, pas encore exploités pour enrichir les modèles générés.
- Postman v2.1 :
	- `auth` (collection/folder/request) : Converti vers `components.securitySchemes` + `security` operation.
	- Body modes (`raw`, `urlencoded`, `formdata`, `file`, `graphql`) : Convertis en `requestBody`.
	- Folders imbriqués (`item-group`) : Supportés.
	- Variables (`variable`) : Partiel (propagation pour contexte/documentation, pas de moteur de templating complet).
	- Events/scripts (`event`) : Non convertis en logique exécutable (documentés mais non transpilés).
- RAML 1.0 :
	- Ressources imbriquées + `uriParameters`/`queryParameters` : Supportés.
	- `types` (objets/arrays/unions/discriminator de base) : Support partiel vers schémas OpenAPI.
	- Traits/resourceTypes/securitySchemes modulaires : Partiel (dépend du pré-traitement RAML en entrée).
	- Includes/libraries/overlays/extensions : Partiel selon parser YAML et résolution effective fournie.
- API Blueprint :
	- Sections Group/Resource/Action/Response : Supportées.
	- Data Structures/MSON avancé : Partiel (normalisation orientée endpoints d'abord).
- GraphQL introspection :
	- Root query/mutation : Supporté.
	- Args -> paramètres/requestBody : Supporté.
	- Interfaces/unions -> `oneOf` : Support partiel.
	- Directives, subscriptions, semantics runtime : Non transpilés en comportement HTTP complet.

### Limites de couverture (important)

- GraphQL SDL non introspecté n'est pas pris en charge directement.
- Les extensions propriétaires (`x-*`, conventions vendor) sont partiellement conservées mais peu exploitées pour la génération de modèles Outlet.
- L'inférence des relations reste heuristique et dépend de la qualité des schémas disponibles.

## Réponse courte a la question principale

La fonctionnalité couvre maintenant les formats majeurs et une part significative des variations complexes demandées.

Elle ne couvre pas encore 100% des variantes avancées de chaque écosystème (notamment scripts Postman, overlays RAML complexes, sémantique GraphQL non introspectable, et certains patterns multi-docs).

## Limites techniques connues

- Les conversions non OpenAPI natif produisent une spec OpenAPI canonique simplifiée.
- Certains éléments peuvent nécessiter des ajustements manuels côté modèles générés.
- L'inférence des relations est partielle selon la qualité des schemas.

## Bonnes pratiques recommandées

- Fournir l'URL directe de la spec JSON (`openapi.json`, `swagger.json`, `v3/api-docs`, etc.).
- Versionner la spec dans le repo si possible (stabilité CI/CD).
- Lancer ensuite un contrôle de divergence avec `outlet-api-diff`.

## Références standards consultées

- OpenAPI Specification (latest): https://spec.openapis.org/oas/latest.html
- Postman Collection Schema v2.1.0: https://schema.postman.com/collection/json/v2.1.0/draft-07/collection.json
- RAML 1.0 spec: https://github.com/raml-org/raml-spec/blob/master/versions/raml-10/raml-10.md
- API Blueprint spec: https://apiblueprint.org/documentation/specification.html
- GraphQL introspection (October 2021): https://spec.graphql.org/October2021/#sec-Schema-Introspection

## Cible d'évolution recommandée

Pour renforcer encore le flux "URL doc -> conversion automatique (CLI + MCP)", il reste prioritaire d'ajouter :

1. Intégration MCP dédiée

- Un outil MCP `api_import_from_doc` qui accepte `docUrl` et demande `modelsDir` seulement si nécessaire.

1. Mode interactif CLI

- Si `--output` absent, proposer des dossiers candidats (`models/`, `src/models/`, etc.).

1. Conversion avancée complémentaire

- Résolution multi-doc OpenAPI robuste (`$ref` externes + cycles contrôlés).
- Mapping explicite Postman `event` -> hooks générables.
- Support RAML overlays/extensions et bibliothèques avec résolution complète.
- Couverture MSON/API Blueprint plus profonde (Data Structures riches).

## Exemple de flux cible (proposé)

```bash
# URL de documentation (pas forcément JSON direct)
npx outlet-api-import --doc https://api.exemple.com/swagger

# L'outil résout la spec, puis demande le dossier des modèles si absent
# Ensuite il génère automatiquement les modèles et relations
```

## Statut

- Statut actuel : Multi-format actif (OpenAPI/Swagger, YAML, Swagger UI, Postman, RAML, API Blueprint, GraphQL introspection)
- Statut cible : Couverture avancée + intégration MCP native
