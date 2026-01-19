const fs = require('fs');
const path = require('path');

const files = [
    '美容組_學科題庫.json',
    '基礎描繪組_學科題庫.json',
    '職業安全工作倫理_題庫.json'
];

files.forEach(filename => {
    const filePath = path.join(__dirname, 'questions', filename);
    console.log(`\n--- 檔案: ${filename} ---`);
    try {
        const rawData = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(rawData);

        console.log(`JSON 物件總數: ${data.length}`);

        const filteredOut = [];
        data.forEach((item, index) => {
            const id = item['編號'];
            const question = item['題目'];

            if (!(id && question)) {
                filteredOut.push({
                    index: index + 1,
                    id: id,
                    reason: !id ? '缺失編號' : '缺失題目',
                    content: JSON.stringify(item).substring(0, 50) + '...'
                });
            }
        });

        if (filteredOut.length > 0) {
            console.log(`會被過濾掉的目數: ${filteredOut.length}`);
            filteredOut.forEach(f => {
                console.log(`  - 第 ${f.index} 個物件 (編號: ${f.id}): ${f.reason}`);
                console.log(`    內容: ${f.content}`);
            });
        } else {
            console.log('全部題目皆符合過濾條件 (id && question 都有值)。');
        }

    } catch (err) {
        console.error(`解析失敗: ${err.message}`);
    }
});
