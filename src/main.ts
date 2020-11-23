// Application Config
const sheet = SpreadsheetApp.getActiveSpreadsheet();
const configSheetName: string = 'GAS CONFIG';
const successColor: string = '#b7e1cd';
const failureColor: string = '#f4c7c3';

type Config = {
  targetSheet: GoogleAppsScript.Spreadsheet.Sheet;
  urlColumn: number;
  lastWorkColumn: number;
  nextWorkColumn: number;
  startRow: number;
};

type GirlsInfo = {
  lastWork: string,
  nextWork: string
};

type WorkDayInfo = {
  workDay: string,
  workTime: string
};

enum BatchResult {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE'
};

class PageNotFoundError {};
class ElementNotFoundError {};
class UnknownError {};

// Config
class ConfigClient {
  readonly configSheet: GoogleAppsScript.Spreadsheet.Sheet;

  constructor() {
    this.configSheet = sheet.getSheetByName(configSheetName);
  }

  public getConfig(): Config {
    const sheetName: string = this.configSheet.getRange(8, 3).getDisplayValue();
    const targetSheet = sheet.getSheetByName(sheetName);
    if (sheet.getSheetByName(configSheetName) == null) {
      throw 'The config sheet does not exist.'
    }
    const config: Config = {
      targetSheet: targetSheet,
      urlColumn: this.configSheet.getRange(9, 3).getValue(),
      lastWorkColumn: this.configSheet.getRange(10, 3).getValue(),
      nextWorkColumn: this.configSheet.getRange(11, 3).getValue(),
      startRow: this.configSheet.getRange(12, 3).getValue()
    } 
    return config;
  }

  public setTimestamp(): void {
    // バッチの実行日時をシートに書き込む
    const targetCell = this.configSheet.getRange(4, 3);
    const date = new Date();
    const timestamp = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd/HH:mm:ss');
    targetCell.setValue(timestamp);
    return;
  }

  public setBatchResult(result: BatchResult): void {
    // バッチの実行結果をシートに書き込む
    const targetCell = this.configSheet.getRange(5, 3);
    targetCell.setValue(result);
    if (result === BatchResult.SUCCESS) {
      targetCell.setBackground(successColor);
    } else {
      targetCell.setBackground(failureColor);
    }
    return;
  }
}

class FetchGirlsInfoClient {
  // シティヘブンのスクレイピング処理(実行単位は行ごと)
  public fetchGirlsInfo(url: string): WorkDayInfo[] | PageNotFoundError | ElementNotFoundError | UnknownError {
    try {
      const res = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
      if (res.getResponseCode() == 404) return new PageNotFoundError();
      const content = res.getContentText();
      const itemRegexp = new RegExp(/<ul id="girl_sukkin">([\s\S]*?)<\/ul>/g);
      const matchContent = content.match(itemRegexp);
      if (matchContent == null) return new ElementNotFoundError();
      const availableWorkArray = this.parseWorkDayInfo(matchContent.toString());
      return availableWorkArray;
    } catch(e) {
      Logger.log(e);
      Logger.log('unknown error occered');
      return new UnknownError();
    }
  }

  private parseWorkDayInfo(content: string): WorkDayInfo[] | UnknownError{
    // 出勤情報のテーブルをパースして日付昇順で配列に入れる
    let workDayInfoArray: WorkDayInfo[] = [];

    const tableRegexp = new RegExp(/<dl>([\s\S]*?)<\/dl>/g);
    const workDayRegexp = new RegExp(/\d{1,2}\/\d{1,2}/g);
    const workTimeRegexp = new RegExp(/\d{1,2}:\d{1,2}/g);
    
    const tableData = content.match(tableRegexp);
    if (tableData == null) {
      return new UnknownError();
    }
    // テーブル内の行（列）を繰り返し
    tableData.forEach((value: string): void => {
      const targetDay = value.match(workDayRegexp);
      const targetTime = value.match(workTimeRegexp);
      // 日付・出勤時間が見つからなければ飛ばす
      if (targetDay === null || targetTime === null) return;
      const availableWork: WorkDayInfo = {
        workDay: targetDay.toString(),
        workTime: targetTime.toString().replace(',', ' - ')
      }
      workDayInfoArray.push(availableWork);
    })
    return workDayInfoArray;
  }
}

class CheckGirlsInfoService {
  // 退店・出勤チェック + シートへの転記
  private config: Config;
  private fetchGirlsClient: FetchGirlsInfoClient;

  constructor(config: Config) {
    this.config = config;
    this.fetchGirlsClient = new FetchGirlsInfoClient();
  }

  public setCheckResult() {
    const targetSheet = this.config.targetSheet;
    const lastRow = targetSheet.getLastRow();
    const today = new Date();
    const todayString: string = Utilities.formatDate(today, 'Asia/Tokyo', 'M/d');
    
    // 行ごとに繰り返し
    for(let i: number = this.config.startRow; i <= lastRow; i++) {
      const targetUrl: string = targetSheet.getRange(i, this.config.urlColumn).getDisplayValue();
      // URL欄が空白ならスキップ
      if (targetUrl == '') continue;
      let availableWorkArray = this.fetchGirlsClient.fetchGirlsInfo(targetUrl);
      const lastWorkCell: GoogleAppsScript.Spreadsheet.Range = targetSheet.getRange(i, this.config.lastWorkColumn);
      const nextWorkCell: GoogleAppsScript.Spreadsheet.Range = targetSheet.getRange(i, this.config.nextWorkColumn);

      // ページが見つからなかった時
      if (availableWorkArray instanceof PageNotFoundError) {
        nextWorkCell.setValue('退店');
        nextWorkCell.setBackground(failureColor);
      }
      //取得できなかったとき
      else if (availableWorkArray instanceof ElementNotFoundError) {
        nextWorkCell.setValue('出勤情報取得不可');
        nextWorkCell.setBackground(failureColor);
      }
      // その他予測外の例外
      else if (availableWorkArray instanceof UnknownError || availableWorkArray == null) {
        nextWorkCell.setValue('スクリプトエラー');
        nextWorkCell.setBackground(failureColor);
      }
      // 出勤がない時
      else if (availableWorkArray.length === 0) {
        nextWorkCell.setValue('次回出勤予定なし');
      }
      // 今日が出勤日の場合
      else if (todayString === availableWorkArray[0].workDay){
        // 今日以外にも出勤日がある
        if (availableWorkArray.length >= 2) {
          lastWorkCell.setValue(availableWorkArray[0].workDay + ' ' + availableWorkArray[0].workTime);
          nextWorkCell.setValue(availableWorkArray[1].workDay + ' ' + availableWorkArray[1].workTime);
        // 今日しか出勤日がない
        } else {
          lastWorkCell.setValue(availableWorkArray[0].workDay + ' ' + availableWorkArray[0].workTime);
          nextWorkCell.setValue('次回出勤予定なし');
        }
      }
      // 今日が出勤日でない場合
      else {
        nextWorkCell.setValue(availableWorkArray[0].workDay + ' ' + availableWorkArray[0].workTime);
      }
    }
    return;
  }
}

// 日次での退店・出勤日取得バッチ
function dairyBatch() {
  const configClient = new ConfigClient();
  configClient.setTimestamp();
  try {
    const config = configClient.getConfig();
    const checkGirlsInfoService = new CheckGirlsInfoService(config)
    checkGirlsInfoService.setCheckResult();

    // 成功
    configClient.setBatchResult(BatchResult.SUCCESS);
  } catch(e) {
    Logger.log(e);
    // 失敗
    configClient.setBatchResult(BatchResult.FAILURE);
  }
  return;
}
