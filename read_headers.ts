import * as ExcelJS from 'exceljs';
import * as path from 'path';

async function main() {
    const filePath = path.resolve(__dirname, 'FLOTILLA2.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    for (const ws of workbook.worksheets) {
        console.log(`\nHoja: ${ws.name}`);
        // Read first 5 rows
        for (let i = 1; i <= 5; i++) {
            const row = ws.getRow(i);
            const values: string[] = [];
            row.eachCell({ includeEmpty: true }, (cell) => {
                values.push(cell.value?.toString().trim().toUpperCase().replace(/\s+/g, ' ') || '');
            });
            if (values.filter(Boolean).length > 0) {
                console.log(`Row ${i}:`, values.filter(Boolean).join(' | '));
            }
        }
    }
}

main().catch(console.error);
