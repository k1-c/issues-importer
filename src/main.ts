// github issue 作成エンドポイント
const githuburl = (username, repository) => `https://api.github.com/repos/${username}/${repository}/issues`;

// request 作成関数
const createOptions = (accesstoken) => {
  return (payload): GoogleAppsScript.URL_Fetch.URLFetchRequestOptions => 
    ({
      method: "post",
      contentType: 'application/json',
      headers: {
        Authorization : `token ${accesstoken}`
      },
      payload: payload
    });
};

const createIssue = () => {
  // シート情報取得
  SpreadsheetApp.getActiveSpreadsheet();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getActiveSheet();
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const issueCount = lastRow - 1;
  const range = sheet.getRange(2,1,issueCount,lastColumn); // A2 - C[issueCount]の範囲
  const issueRows = range.getValues()

  // スクリプトのプロパティ
  const properties = PropertiesService.getScriptProperties()
  const issueNumberCol = Number(properties.getProperty("COLUMN_ISSUE_NUMBER")) - 1
  const titleCol = Number(properties.getProperty("COLUMN_TITLE")) - 1
  const bodyCol = Number(properties.getProperty("COLUMN_BODY")) - 1
  const labelCol = Number(properties.getProperty("COLUMN_LABEL")) - 1
  const assigneesCol = Number(properties.getProperty("COLUMN_ASSIGNEES")) - 1
  const accesstoken = properties.getProperty("ACCESS_TOKEN")
  const username = properties.getProperty("USER_NAME")
  const repository = properties.getProperty("REPOSITORY")

  // url
  const url = githuburl(username, repository)

  // リクエスト作成用の関数作成
  const request = createOptions(accesstoken)

  // issue作成
  const issues = issueRows.map(row => {
    if(!row[issueNumberCol]){
      try {
        const issue = {title: row[titleCol], body: row[bodyCol], labels: row[labelCol] ? row[labelCol].split(',') : [], assignees: row[assigneesCol] ? row[assigneesCol].split(',') : []}
        const option = request(JSON.stringify(issue))
        const res = JSON.parse(UrlFetchApp.fetch(url, option).getContentText())
        const hyperlink = `=HYPERLINK("${res.html_url ?? ''}","#${res.number ?? ''}")`
        row.splice(issueNumberCol, 1, hyperlink)
      } catch(e) {
        row.splice(issueNumberCol, 1, e)
      }
    }
    return row
  })

  range.setValues(issues)
};

// 確認
const confirmation = () => {
  const confirmed = Browser.msgBox("このシートからgithub issuesを作成しますか？", Browser.Buttons.OK_CANCEL);
  if(confirmed == 'ok') {
    createIssue()
  }
};

// ファイルを開いたときにメニューを追加する
const onOpen = () => {
  const myMenu = [
    {name: "Issues Update", functionName: "confirmation"}
  ]
  SpreadsheetApp.getActiveSpreadsheet().addMenu("GitHub",myMenu)
};