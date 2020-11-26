// github issue 作成エンドポイント
const githuburl = (username, repository) => `https://api.github.com/repos/${username}/${repository}/issues`;

// request 作成関数
const createRequest = (url, accesstoken) => {
  return (payload) => 
    ({
      url: url,
      method: "post",
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
  const issueCount = lastRow - 1;
  const range = sheet.getRange(2,1,issueCount,5); // A2 - C[issueCount]の範囲
  const issueRows = range.getValues()

  // issue 情報
  const issues = issueRows.map(row => {
    if(!row[0]) return {title: row[1], body: row[2], labels: row[3] ? row[3].split(',') : []}
    return null
  }).filter(v => v)

  Logger.log(issues)

  // スクリプトのプロパティ
  const properties = PropertiesService.getScriptProperties()
  const accesstoken = properties.getProperty("ACCESS_TOKEN")
  const username = properties.getProperty("USER_NAME")
  const repository = properties.getProperty("REPOSITORY")

  // url
  const url = githuburl(username, repository)

  // リクエスト作成用の関数作成
  const request = createRequest(url, accesstoken)

  // リクエスト作成
  const requests = issues.map(issue => request(JSON.stringify(issue)))

  // issue 作成リクエスト送信
  UrlFetchApp.fetchAll(requests as GoogleAppsScript.URL_Fetch.URLFetchRequest[])
}; 

// 確認
const confirmation = () => {
  const confirmed = Browser.msgBox("github issue を作成しますか？", Browser.Buttons.OK_CANCEL);
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