const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'questions', '美容組_學科題庫.json');

try {
    const rawData = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(rawData);

    console.log(`總題數: ${data.length}`);

    const idMap = {};
    data.forEach((item, index) => {
        const id = item['編號'];
        if (!idMap[id]) idMap[id] = [];
        idMap[id].push(index + 1);
    });

    const ids = Object.keys(idMap).map(Number).sort((a, b) => a - b);

    console.log(`最小題號: ${ids[0]}`);
    console.log(`最大題號: ${ids[ids.length - 1]}`);

    const missing = [];
    for (let i = 1; i <= 200; i++) {
        if (!idMap[i]) missing.push(i);
    }

    const duplicates = [];
    for (const id in idMap) {
        if (idMap[id].length > 1) {
            duplicates.push(`${id} (出現在第 ${idMap[id].join(', ')} 個物件)`);
        }
    }

    if (missing.length > 0) {
        console.log(`缺失的題號: ${missing.join(', ')}`);
    } else {
        console.log('1 至 200 號全部正確存在。');
    }

    if (duplicates.length > 0) {
        console.log(`重複的題號: \n${duplicates.join('\n')}`);
    } else {
        console.log('沒有重複的題號。');
    }

} catch (err) {
    console.error('錯誤:', err.message);
}
