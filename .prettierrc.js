module.exports = {
  singleQuote: true,
  tabWidth: 4,
  trailingComma: 'none',
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderParserPlugins: ['typescript', 'decorators-legacy'],
  importOrder: ['<THIRD_PARTY_MODULES>', '^@', '^[./]'],
  overrides: [
    {
      files: '*.html',
      options: {
        parser: 'angular',
        tabWidth: 4,
      },
    },
    {
      files: '*.json',
      options: {
        parser: 'json',
        tabWidth: 4,
      },
    },
    {
      files: '*.ts',
      options: {
        parser: 'typescript',
        tabWidth: 4,
      },
    },
    {
      files: '*.yml',
      options: {
        singleQuote: false,
        parser: 'yaml',
        tabWidth: 2,
      },
    },
  ],
};
