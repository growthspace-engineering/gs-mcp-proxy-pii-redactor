// @ts-check
/**
 * @type {import("eslint").Linter.Config}
 */
const config = {
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module'
  },
  env: {
    es6: true,
    node: true
  },
  globals: {
    MyGlobal: true
  },
  ignorePatterns: [
    '**/db/models/*.js',
    '**/lib/**/*.ts'
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    'template-curly-spacing': [ 'error', 'always' ],
    'space-infix-ops': 'error',
    'array-bracket-newline': 'off',
    'array-bracket-spacing': [ 'error', 'always' ],
    'array-element-newline': 'off',
    'block-spacing': [ 'error', 'always' ],
    'brace-style': [ 'error', '1tbs', {
      'allowSingleLine': true
    } ],
    'camelcase': [ 'error', {
      'properties': 'never'
    } ],
    'comma-dangle': [ 'error', 'never' ],
    'comma-spacing': [ 'error', {
      'after': true,
      'before': false
    } ],
    'comma-style': 'error',
    'computed-property-spacing': 'error',
    'curly': [ 'error', 'multi-line' ],
    'eol-last': 'error',
    'func-call-spacing': 'error',
    'indent': [ 'error', 2, {
      'CallExpression': {
        'arguments': 1
      },
      'FunctionDeclaration': {
        'body': 1,
        'parameters': 1
      },
      'FunctionExpression': {
        'body': 1,
        'parameters': 1
      },
      'ignoredNodes': [ 'ConditionalExpression' ],
      'MemberExpression': 1,
      'ObjectExpression': 1,
      'SwitchCase': 1
    } ],
    'key-spacing': 'error',
    'keyword-spacing': 'error',
    'linebreak-style': 'error',
    'max-len': [ 'warn', {
      // starting small (forcing 120), but later we should force 80
      code: 80,
      ignoreComments: true,
      ignoreUrls: true,
      ignoreStrings: true,
      tabWidth: 2
    } ],
    'no-array-constructor': 'error',
    'no-caller': 'error',
    'no-extend-native': 'error',
    'no-extra-bind': 'error',
    'no-invalid-this': 'error',
    'no-irregular-whitespace': 'error',
    'no-mixed-spaces-and-tabs': 'error',
    'no-multi-spaces': 'error',
    'no-multi-str': 'error',

    'no-multiple-empty-lines': [ 'error', {
      max: 2
    } ],
    'no-new-object': 'error',
    'no-new-wrappers': 'error',
    'no-tabs': 'error',
    'no-throw-literal': 'error',
    'no-trailing-spaces': 'error',
    '@typescript-eslint/no-unused-vars': 'off',
    'no-unused-vars': [ 'warn', {
      args: 'none'
    } ],

    'no-with': 'error',
    'object-curly-spacing': [ 'error', 'always' ],
    'one-var': [ 'error', {
      const: 'never',
      let: 'never',
      var: 'never'
    } ],
    'operator-linebreak': [ 'error', 'after' ],
    'padded-blocks': [ 'error', 'never' ],
    'prefer-promise-reject-errors': 'error',
    'quotes': [ 'error', 'single', {
      allowTemplateLiterals: true
    } ],
    'semi': [ 'error' ],
    'semi-spacing': 'error',
    // 'valid-jsdoc': [ 'error', {
    //   prefer: {
    //     returns: 'return'
    //   },
    //   requireParamDescription: false,
    //   requireReturn: false,
    //   requireReturnDescription: false
    // } ],
    'space-before-blocks': 'error',
    'space-before-function-paren': [ 'error', {
      asyncArrow: 'always',
      anonymous: 'never',
      named: 'never'
    } ],
    'spaced-comment': [ 'error', 'always' ],
    'switch-colon-spacing': 'error',
    'arrow-parens': [ 'error', 'always' ],
    'constructor-super': 'error', // eslint:recommended
    'generator-star-spacing': [ 'error', 'after' ],
    'no-new-symbol': 'error', // eslint:recommended
    'no-this-before-super': 'error', // eslint:recommended
    'no-var': 'error',
    'prefer-const': [ 'error', { destructuring: 'all' } ],
    'prefer-rest-params': 'error',
    'prefer-spread': 'error',
    'rest-spread-spacing': 'error',
    'yield-star-spacing': [ 'error', 'after' ],
    // 'no-await-in-loop': 'warn',
    'no-unreachable-loop': 'error',
    // 'require-atomic-updates': 'error',
    'dot-notation': 'error',
    // 'require-await': 'warn',
    // 'no-shadow': 'warn',
    'line-comment-position': [ 'error', { position: 'above' } ]
  },
  overrides: [
    {
      files: [ '*.ts', '*.tsx' ],
      parser: '@typescript-eslint/parser',
      plugins: [
        '@typescript-eslint/eslint-plugin',
        'unused-imports',
        'simple-import-sort',
        'import'
      ],
      parserOptions: {
        project: [
          './tsconfig.eslint.json'
        ],
        sourceType: 'module'
      },
      extends: [
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended'
      ],
      env: {
        node: true,
        jest: true
      },
      /**
     * Typescript Rules
     * https://github.com/bradzacher/eslint-plugin-typescript
     * Enable your own typescript rules.
     */
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'unused-imports/no-unused-imports': 'error',
        'simple-import-sort/imports': [ 'error', {
          groups: [
          // 1. built-in node.js modules
            [ `^(${ require('module').builtinModules.join('|') })(/|$)` ],
            // 2.1. package that start without @
            // 2.2. package that start with @
            [ '^\\w', '^@\\w' ],
            // 3. @nestjs packages
            [ '^@nestjs\/' ],
            // 4. @growthspace-engineering packages
            [ '^@growthspace-engineering\/' ],
            // 5. Internal growthspace packages (inside this project)
            [ '^@gs-' ],
            // 6. Parent imports. Put `..` last.
            //    Other relative imports. Put same-folder imports and `.` last.
            [ '^\\.\\.(?!/?$)', '^\\.\\./?$', '^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$' ],
            // 7. Side effect imports.
            // https://riptutorial.com/javascript/example/1618/importing-with-side-effects
            [ '^\\u0000' ]
          ]
        } ],
        'import/first': 'error',
        'import/newline-after-import': 'error',
        'import/no-duplicates': 'error',
        'eol-last': [ 2, 'windows' ],
        'comma-dangle': [ 'error', 'never' ],
        '@typescript-eslint/no-empty-interface': 'error',
        '@typescript-eslint/member-delimiter-style': 'error',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/naming-convention': [
          'error',
          {
            'selector': 'interface',
            'format': [ 'PascalCase' ],
            'custom': {
              'regex': '^I[A-Z]',
              'match': true
            }
          }
        ],
        '@typescript-eslint/semi': [ 'error' ],
        'space-infix-ops': 'error',
        'array-bracket-newline': 'off',
        'array-bracket-spacing': [ 'error', 'always' ],
        'array-element-newline': 'off',
        'block-spacing': [ 'error', 'always' ],
        'brace-style': [ 'error', '1tbs', {
          'allowSingleLine': true
        } ],
        'camelcase': [ 'error', {
          'properties': 'never'
        } ],
        'comma-spacing': [ 'error', {
          'after': true,
          'before': false
        } ],
        'comma-style': 'error',
        'computed-property-spacing': 'error',
        'curly': [ 'error', 'multi-line' ],
        'func-call-spacing': 'error',
        'indent': [ 'error', 2, {
          'CallExpression': {
            'arguments': 1
          },
          'FunctionDeclaration': {
            'body': 1,
            'parameters': 1
          },
          'FunctionExpression': {
            'body': 1,
            'parameters': 1
          },
          'ignoredNodes': [ 'ConditionalExpression' ],
          'MemberExpression': 1,
          'ObjectExpression': 1,
          'SwitchCase': 1
        } ],
        'key-spacing': 'error',
        'keyword-spacing': 'error',
        'linebreak-style': 'error',
        'max-len': [ 'warn', {
        // starting small (forcing 120), but later we should force 80
          code: 80,
          ignoreComments: true,
          ignoreUrls: true,
          ignoreStrings: true,
          tabWidth: 2
        } ],
        'no-array-constructor': 'error',
        'no-caller': 'error',
        'no-extend-native': 'error',
        'no-extra-bind': 'error',
        'no-invalid-this': 'error',
        'no-irregular-whitespace': 'error',
        'no-mixed-spaces-and-tabs': 'error',
        'no-multi-spaces': 'error',
        'no-multi-str': 'error',

        'no-multiple-empty-lines': [ 'error', {
          max: 2
        } ],
        'no-new-object': 'error',
        'no-new-wrappers': 'error',
        'no-tabs': 'error',
        'no-throw-literal': 'error',
        'no-trailing-spaces': 'error',
        '@typescript-eslint/no-unused-vars': 'off',
        'no-unused-vars': [ 'warn', {
          args: 'none'
        } ],

        'no-with': 'error',
        'object-curly-spacing': [ 'error', 'always' ],
        'one-var': [ 'error', {
          const: 'never',
          let: 'never',
          var: 'never'
        } ],
        'operator-linebreak': [ 'error', 'after' ],
        'padded-blocks': [ 'error', 'never' ],
        'prefer-promise-reject-errors': 'error',
        'quotes': [ 'error', 'single', {
          allowTemplateLiterals: true
        } ],
        'semi': [ 'error' ],
        'semi-spacing': 'error',
        'space-before-blocks': 'error',
        'space-before-function-paren': [ 'error', {
          asyncArrow: 'always',
          anonymous: 'never',
          named: 'never'
        } ],
        'spaced-comment': [ 'error', 'always' ],
        'switch-colon-spacing': 'error',
        'arrow-parens': [ 'error', 'always' ],
        'constructor-super': 'error', // eslint:recommended
        'generator-star-spacing': [ 'error', 'after' ],
        'no-new-symbol': 'error', // eslint:recommended
        'no-this-before-super': 'error', // eslint:recommended
        'no-var': 'error',
        'prefer-const': [ 'error', { destructuring: 'all' } ],
        'prefer-rest-params': 'error',
        'prefer-spread': 'error',
        'rest-spread-spacing': 'error',
        'yield-star-spacing': [ 'error', 'after' ],
        // 'no-await-in-loop': 'warn',
        'no-unreachable-loop': 'error',
        'require-atomic-updates': 'error',
        'dot-notation': 'error',
        // 'require-await': 'warn',
        'line-comment-position': [ 'error', { position: 'above' } ],
        'template-curly-spacing': [ 'error', 'always' ]
      }
    },
    {
      files: [
        '**/*.mjs'
      ],
      env: {
        node: true
      },
      plugins: [
        'unused-imports',
        'simple-import-sort',
        'import'
      ],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'unused-imports/no-unused-imports': 'error',
        'simple-import-sort/imports': [ 'error', {
          groups: [
          // 1. built-in node.js modules
            [ `^(${ require('module').builtinModules.join('|') })(/|$)` ],
            // 2.1. package that start without @
            // 2.2. package that start with @
            [ '^\\w', '^@\\w' ],
            // 3. @nestjs packages
            [ '^@nestjs\/' ],
            // 4. @growthspace-engineering packages
            [ '^@growthspace-engineering\/' ],
            // 5. Internal growthspace packages (inside this project)
            [ '^@gs-' ],
            // 6. Parent imports. Put `..` last.
            //    Other relative imports. Put same-folder imports and `.` last.
            [ '^\\.\\.(?!/?$)', '^\\.\\./?$', '^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$' ],
            // 7. Side effect imports.
            // https://riptutorial.com/javascript/example/1618/importing-with-side-effects
            [ '^\\u0000' ]
          ]
        } ],
        'import/first': 'error',
        'import/newline-after-import': 'error',
        'import/no-duplicates': 'error'
      }
    }
  ]
};

module.exports = config;
