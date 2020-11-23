module.exports = {
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'initial commit',
        'feat',
        'fix',
        'docs',
        'refactor',
        'test',
        'chore',
        'wip',
      ],
    ],
  },
  extends: ['@commitlint/config-conventional'],
}
