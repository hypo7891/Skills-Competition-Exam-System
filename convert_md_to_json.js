const fs = require('fs');
const path = require('path');

const mdPath = 'h:/我的雲端硬碟/Gemini_CLI/建構題庫系統/題庫原稿/共通題庫/114國中技藝競賽【化工-職業安全衛生、工作倫理與職業道德、環境保護、節能減碳】學科題庫60.md';
const outputPath = 'd:/GITHUB/Skills-Competition-Exam-System/questions/職業安全工作倫理_題庫.json';

try {
    const content = fs.readFileSync(mdPath, 'utf8');

    // Split by question number start, e.g., "1.【 A 】"
    const questions = [];
    const questionBlocks = content.split(/\n\s*(\d+)\.\s*【\s*([A-D])\s*】/);

    // questionBlocks[0] is header
    // [1] = "1", [2] = "A", [3] = rest of question 1 text
    // [4] = "2", [5] = "B", [6] = rest of question 2 text

    for (let i = 1; i < questionBlocks.length; i += 3) {
        let num = questionBlocks[i];
        const ans = questionBlocks[i + 1];
        let text = questionBlocks[i + 2].trim();

        // Fix the typo in source where Question 10 is repeated at position 20
        if (num === "10" && i > 30) {
            num = "20";
        }

        // Extract question and options
        // Expected format: Question(A)OptionA　(B)OptionB　(C)OptionC　(D)OptionD
        const optionRegex = /\(A\)(.*?)\(B\)(.*?)\(C\)(.*?)\(D\)(.*?)(\s|$|>)/s;
        const match = text.match(optionRegex);

        if (match) {
            const questionText = text.replace(optionRegex, '').trim().replace(/\n/g, ' ');
            questions.push({
                "編號": num,
                "解答": ans,
                "題目": questionText,
                "選項A": match[1].trim().replace(/\s+$/, ''),
                "選項B": match[2].trim().replace(/\s+$/, ''),
                "選項C": match[3].trim().replace(/\s+$/, ''),
                "選項D": match[4].trim().replace(/\s+$/, ''),
                "詳解": ""
            });
        } else {
            console.log(`警告: 無法解析第 ${num} 題的選項。內容: ${text.substring(0, 100)}...`);
        }
    }

    fs.writeFileSync(outputPath, JSON.stringify(questions, null, 4), 'utf8');
    console.log(`成功生成 ${questions.length} 題，已儲存至 ${outputPath}`);

} catch (err) {
    console.error('發生錯誤:', err.message);
}
