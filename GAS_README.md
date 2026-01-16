# Google Apps Script Setup Instructions

為了讓 VIP 考生的成績能自動填入 Google 試算表，請依照以下步驟設定後端腳本：

1. **開啟您的 Google 試算表**
   - [點此開啟您的試算表](https://docs.google.com/spreadsheets/d/1nogCcWFBGRN212xQBQHcJdYrZEgcSWAROHrBKgK7vyE/edit?usp=sharing)

2. **開啟 Apps Script**
   - 在上方選單點選 **擴充功能 (Extensions)** > **Apps Script**。

3. **貼上程式碼**
   - 刪除編輯器中原有的程式碼 (`function myFunction() {...}`)。
   - 貼上以下程式碼：

```javascript

function doGet(e) {
  try {
    // 檢查是否有傳入 name 參數
    var name = e.parameter.name;
    if (!name) {
       return ContentService.createTextOutput(JSON.stringify({"result": "error", "error": "Missing name parameter"}))
      .setMimeType(ContentService.MimeType.JSON);
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var lastRow = sheet.getLastRow();
    
    // 若無資料
    if (lastRow < 2) {
      return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 取得所有資料 (假設資料量不大，一次讀取比較快)
    // 範圍：A2 到 F最後一列
    var data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    
    // 收集該考生的錯題
    var wrongQuestionsMap = {}; // 用 ID 當 key 去除重複
    
    // 倒序讀取，優先顯示最近的錯題 (雖然 map 會去重，但我們可以先保留最新的)
    for (var i = data.length - 1; i >= 0; i--) {
      var row = data[i];
      var rowName = row[1]; // B欄: 姓名
      var detailJson = row[5]; // F欄: 詳細
      
      if (rowName === name && detailJson) {
        try {
          var details = JSON.parse(detailJson);
          details.forEach(function(item) {
            // item 結構: {id, q, ans, correct}
            if (!wrongQuestionsMap[item.id]) {
               wrongQuestionsMap[item.id] = item;
            }
          });
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
    
    // 轉回陣列
    var resultList = Object.keys(wrongQuestionsMap).map(function(key) {
      return wrongQuestionsMap[key];
    });
    
    // 根據 ID 排序 (可選)
    resultList.sort(function(a, b) {
      return parseInt(a.id) - parseInt(b.id);
    });
    
    return ContentService.createTextOutput(JSON.stringify(resultList))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
     return ContentService.createTextOutput(JSON.stringify({"result": "error", "error": error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    // 取得資料
    var data = JSON.parse(e.postData.contents);
    
    // 取得目前的試算表與工作表
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // 準備要寫入的資料列 
    // 順序：時間(Client端), 姓名, 分數, 答對題數, 錯題編號, 詳細內容
    var rowData = [
      data.time || new Date(), // A欄: 時間
      data.name,               // B欄: 姓名
      data.score,              // C欄: 分數
      data.summary,            // D欄: 答對題數 summary
      data.wrong_ids,          // E欄: 錯題編號 (New)
      data.detail              // F欄: 詳細 (JSON string or text)
    ];
    
    // 寫入試算表
    sheet.appendRow(rowData);
    
    // 回傳成功訊息
    return ContentService.createTextOutput(JSON.stringify({"result": "success"}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
     return ContentService.createTextOutput(JSON.stringify({"result": "error", "error": error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

```

4. **部署為網頁應用程式**
   - 點選右上角的 **部署 (Deploy)** > **新增部署 (New deployment)**。
   - 點選左側齒輪圖示 > **網頁應用程式 (Web app)**。
   - 設定如下：
     - **說明**: `VIP 成績紀錄` (隨意填寫)
     - **執行身分 (Execute as)**: **我 (Me)**
     - **誰可以存取 (Who has access)**: **任何人 (Anyone)** (這點很重要，否則前端無法寫入)
   - 點選 **部署 (Deploy)**。
   - (若跳出授權視窗，請點選 **核對權限** > 選擇帳號 > **進階** > **前往... (不安全)** > **允許**)

5. **複製網址**
   - 部署成功後，會顯示一串 **Web App URL** (以 `https://script.google.com/...` 開頭)。
   - **請複製這串網址**，並貼給 AI，或稍後自行填入 `script.js` 中。
