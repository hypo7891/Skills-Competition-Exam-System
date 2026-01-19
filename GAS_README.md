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
    
    // 去除輸入名字的前後空白，並轉為字串
    name = String(name).trim();

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var lastRow = sheet.getLastRow();
    
    // 若無資料
    if (lastRow < 2) {
      return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 取得所有資料
    // 範圍：A2 到 G最後一列 (變更為 7 欄)
    var data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
    
    // 統計錯題頻率與內容
    var stats = {}; // { "id_bank": { count: 0, detail: object } }
    
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var rowName = row[1]; // B欄: 姓名
      var currentBank = String(row[3]).trim(); // D欄: 題庫類型
      
      // 確保試算表中的名字也轉為字串並去除空白
      var safeRowName = String(rowName).trim();
      
      if (safeRowName === name) {
        var cellF = row[5]; // F欄: 錯題編號 (原 E 欄)
        var cellG = row[6]; // G欄: 詳細內容 (原 F 欄)
        
        var wrongIds = [];
        var detailMap = {};
        
        // 支援 JSON 在 F 欄的情況 (防呆，處理欄位位移的情況)
        var isColumnFShiftedJSON = false;
        try {
          if (typeof cellF === 'string' && cellF.trim().charAt(0) === '[') {
             var parsed = JSON.parse(cellF);
             if (Array.isArray(parsed)) {
               isColumnFShiftedJSON = true;
               parsed.forEach(function(item) {
                 wrongIds.push(item.id);
                 detailMap[item.id] = item;
               });
             }
          }
        } catch (e) { /* Not JSON, fallback to standard handling */ }
        
        if (!isColumnFShiftedJSON) {
           // 標準格式：F欄是ID列表，G欄是JSON詳細資料
           if (typeof cellF === 'string') {
              wrongIds = cellF.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s !== ""; });
           } else if (typeof cellF === 'number') {
              wrongIds = [cellF.toString()];
           }
           
           if (cellG) {
              try {
                var details = JSON.parse(cellG);
                 if (Array.isArray(details)) {
                   details.forEach(function(item) {
                     detailMap[item.id] = item;
                   });
                 }
              } catch (e) { /* ignore */ }
           }
        }

        wrongIds.forEach(function(id) {
           // 複合鍵：id + 題庫，確保不同題庫的同 ID 不會混淆
           var key = id + "_" + currentBank;
           if (!stats[key]) {
             stats[key] = { count: 0, detail: null, bank: currentBank, id: id };
           }
           stats[key].count++;
           
           if (!stats[key].detail && detailMap[id]) {
             stats[key].detail = detailMap[id];
           }
        });
      }
    }
    
    // 轉為陣列
    var resultList = [];
    for (var key in stats) {
      if (stats.hasOwnProperty(key)) {
        var item = stats[key];
        // 取得詳細資料，若無則提供預設值
        var detail = item.detail || { id: item.id, q: "題目資料缺失", ans: "?", correct: "?", correct_text: "", ans_text: "" };
        
        resultList.push({
          id: item.id,
          bank_type: item.bank,
          count: item.count,
          q: detail.q || detail.question,
          ans: detail.ans || detail.userAns, 
          ans_text: detail.ans_text || detail.userAnsText || "",
          correct: detail.correct || detail.answer,
          correct_text: detail.correct_text || detail.correctText || ""
        });
      }
    }
    
    // 排序：出現率由高至低
    resultList.sort(function(a, b) {
      return b.count - a.count;
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
    // 建議順序：A時間, B姓名, C分數, D題庫類型, E摘要, F錯題編號, G詳細內容
    var rowData = [
      data.time || new Date(), // A欄: 時間
      data.name,               // B欄: 姓名
      data.score,              // C欄: 分數
      data.bank_type,          // D欄: 題庫類型 (新增)
      data.summary,            // E欄: 摘要 (原 D 欄)
      data.wrong_ids,          // F欄: 錯題編號 (原 E 欄)
      data.detail              // G欄: 詳細內容 (原 F 欄)
    ];
    
    // 寫入試算表
    sheet.appendRow(rowData);
    
    // *重要*：確保回傳成功，並強制 Content-Type 為 JSON
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
