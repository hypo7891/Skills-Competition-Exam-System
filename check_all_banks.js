const fs = require('fs');
const path = require('path');

const files = ['美容組_學科題庫.json', '基礎描繪組_學科題庫.json', '職業安全工作倫理_題庫.json'];

files.forEach(filename => {
    const filePath = path.join(__dirname, 'questions', filename);
    console.log(`\n--- 檢查檔案: ${filename} ---`);
    try {
        if (!fs.existsSync(filePath)) {
            console.log(`[錯誤] 檔案不存在: ${filePath}`);
            return;
        }
        const rawData = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(rawData);

        console.log(`總物件數: ${data.length}`);

        data.forEach((item, index) => {
            const id = item['編號'];
            const q = item['題目'];

            if (!id || String(id).trim() === '') {
                console.log(`[錯誤] 第 ${index + 1} 個物件缺失編號！`);
            }
            if (!q || String(q).trim() === '') {
                console.log(`[錯誤] 第 ${index + 1} 個物件 (題號: ${id}) 缺失題目！`);
                console.log(`內容範例: ${JSON.stringify(item).substring(0, 100)}...`);
            }
        });

        // Check ID continuity
        const ids = data.map(item => parseInt(item['編號'])).filter(n => !isNaN(n));
        const maxId = ids.length > 0 ? Math.max(...ids, 200) : 200;
        const missing = [];
        for (let i = 1; i <= data.length; i++) {
            if (!ids.includes(i)) missing.push(i);
        }
        if (missing.length > 0) console.log(`[錯誤] 缺失題號: ${missing.join(', ')}`);

    } catch (err) {
        console.error(`讀取 ${filename} 失敗: ${err.message}`);
    }
});
