module.exports = {
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    'indent': ['error', 2],
    // Allow different line endings across OS to reduce noise on Windows
    'linebreak-style': 'off',
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off'
  },
  overrides: [
    {
      files: ['bin/**/*.js', 'lib/**/*.js'],
      rules: {
        // Relax formatting rules for legacy/generated CLI and lib code
        'quotes': 'off',
        'indent': 'off',
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
      }
    }
  ]
};
