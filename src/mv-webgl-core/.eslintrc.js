module.exports = {
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2018,
        sourceType: 'module',
        project: './tsconfig.json',
    },
    extends: [
        // "google",
        'prettier/@typescript-eslint',
        'plugin:@typescript-eslint/recommended',
        'plugin:prettier/recommended',
    ],
    plugins: ['@typescript-eslint/eslint-plugin', 'eslint-plugin-tsdoc'],
    rules: {
        // Place to specify/overwrite ESLint rules
        'tsdoc/syntax': 'error',
        '@typescript-eslint/typedef': 'error',
        '@typescript-eslint/explicit-member-accessibility': [
            'error',
            {
                overrides: {
                    constructors: 'no-public',
                },
            },
        ],
        '@typescript-eslint/explicit-function-return-type': [
            'error',
            {
                allowExpressions: true,
            },
        ],
        'new-cap': 0,
    },
    overrides: [
        {
            files: ['*.spec.ts'],
            rules: {
                'require-tsdoc': 0,
            },
        },
    ],
};
