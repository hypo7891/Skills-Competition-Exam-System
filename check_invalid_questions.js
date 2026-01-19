const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'questions', '美容組_學科題庫.json');

try {
    const rawData = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(rawData);

    data.forEach((item, index) => {
        const id = item['編號'];
        const ans = item['解答'];
        const q = item['題目'];
        const a = item['選項A'];
        const b = item['選項B'];
        const c = item['選項C'];
        const d = item['選項D'];

        const missingFields = [];
        if (!id) missingFields.push('編號');
        if (!ans) missingFields.push('解答');
        if (!q) missingFields.push('題目');
        if (!a) missingFields.push('選項A');
        if (!b) missingFields.push('選項B');
        if (!c) missingFields.push('選項C');
        if (!d) missingFields.push('選項D');

        if (missingFields.length > 0) {
            console.log(`警告: 第 ${index + 1} 個物件 (題號: ${id || '未知'}) 缺少欄位: ${missingFields.join(', ')}`);
        }
    });

} catch (err) {
    console.error('錯誤:', err.message);
}
