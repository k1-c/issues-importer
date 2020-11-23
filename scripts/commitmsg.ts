// コミットメッセージのキーワードを絵文字に置換する

type Words = { [key: string]: string }

const words: Words = {
  'feat: ': ':sparkles: [feat] ',
  'tool: ': ':wrench: [tool] ',
  'fix: ': ':bug: [fix] ',
  'docs: ': ':books: [docs] ',
  'refactor: ': ':recycle: [refactor] ',
  'test: ': ':rotating_light: [test] ',
  'chore: ': ':green_heart: [chore] ',
  'wip: ': ':construction: [wip] ',
}

const replacer = (s: string, replaceObj: Words) => {
  let result: string = s
  Object.keys(replaceObj).forEach((key) => {
    if (s.startsWith(key)) {
      result = s.replace(key, replaceObj[key])
    }
  })
  return result
}
const msgPath = process.env.HUSKY_GIT_PARAMS
const msg = require('fs').readFileSync(msgPath, 'utf-8').trim()
const commitMessage = replacer(msg, words)
require('fs').writeFileSync(msgPath, commitMessage)
