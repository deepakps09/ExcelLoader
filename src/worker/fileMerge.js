import ExcelJS from 'exceljs';
import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

let db = null;
let conn = null;

async function getCSVBuf(file) {
    const fileBuf = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuf);
    const worksheet = workbook.getWorksheet(1);
    
    // Fix: Ensure we actually modify the worksheet cells so csv.writeBuffer sees it
    const seenNames = {};
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
        if (cell.value) {
            let name = cell.value.toString().toLowerCase().trim();
            if (seenNames[name]) {
                seenNames[name]++;
                cell.value = `${name}_${seenNames[name]}`;
            } else {
                seenNames[name] = 1;
                cell.value = name;
            }
        }
    });
    headerRow.commit(); // Ensure changes are saved to the sheet

    const csvBuf = await workbook.csv.writeBuffer();    
    return new Uint8Array(csvBuf);
}

async function startSheetMerge(file) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    
    // Process every sheet in the workbook
    for (let i = 0; i < workbook.worksheets.length; i++) {
        const worksheet = workbook.worksheets[i];
        if (worksheet.actualRowCount === 0) continue;

        // Logic Fix: ExcelJS csv.writeBuffer writes the WHOLE workbook.
        // To get just one sheet, we move it to a temporary workbook.
        const tempWb = new ExcelJS.Workbook();
        const tempWs = tempWb.addWorksheet('Export');
        
        // Copy rows to temp sheet
        worksheet.eachRow((row, rowNumber) => {
            tempWs.getRow(rowNumber).values = row.values;
        });

        const csvBuf = await tempWb.csv.writeBuffer();
        const virtualName = `sheet_temp_${i}.csv`;
        await db.registerFileBuffer(virtualName, new Uint8Array(csvBuf));

        // Merge into the main DuckDB table
        const tableExists = await conn.query(`SELECT * FROM information_schema.tables WHERE table_name = 'merged_data'`);
        if (tableExists.toArray().length === 0) {
            await conn.query(`CREATE TABLE merged_data AS SELECT * FROM read_csv_auto('${virtualName}', all_varchar=True)`);
        } else {
            await conn.query(`INSERT INTO merged_data SELECT * FROM read_csv_auto('${virtualName}', all_varchar=True, union_by_name=True)`);
        }
    }
    // Return something to satisfy the main loop (though we've handled the DB insert here)
    return null; 
}

async function startMerge(selectedFiles) {  
    try {
        const MANUAL_BUNDLES = {
            mvp: { mainModule: duckdb_wasm, mainWorker: mvp_worker },
            eh: { mainModule: duckdb_wasm_eh, mainWorker: eh_worker },
        };
        const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
        const worker = new Worker(bundle.mainWorker);
        const logger = new duckdb.ConsoleLogger();
        
        db = new duckdb.AsyncDuckDB(logger, worker);
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        conn = await db.connect();

        for (let i = 0; i < selectedFiles.value.length; i++) {
            const file = selectedFiles.value[i];
            
            // Fix 1: Await the SheetMerge
            if (selectedFiles.mergeSheets === true) {
                await startSheetMerge(file);
            } else {
                const csvData = await getCSVBuf(file);
                const virtualName = `file_${i}.csv`;
                await db.registerFileBuffer(virtualName, csvData);
                
                const tableExists = await conn.query(`SELECT * FROM information_schema.tables WHERE table_name = 'merged_data'`);
                if (tableExists.toArray().length === 0) {
                    await conn.query(`CREATE TABLE merged_data AS SELECT * FROM read_csv_auto('${virtualName}', all_varchar=true)`);
                } else {
                    await conn.query(`INSERT INTO merged_data SELECT * FROM read_csv_auto('${virtualName}', all_varchar=true, union_by_name=True)`);
                }
            }
        }

        // Export result
        await conn.query("COPY merged_data TO 'output.json' (FORMAT JSON, ARRAY TRUE)");
        const jsonBuffer = await db.copyFileToBuffer('output.json');
        const jsonData = JSON.parse(new TextDecoder().decode(jsonBuffer));

        if (!jsonData || jsonData.length === 0) return null;

        const outWorkbook = new ExcelJS.Workbook();
        const outWorksheet = outWorkbook.addWorksheet('Sheet 1');
        
        outWorksheet.columns = Object.keys(jsonData[0]).map(key => ({ header: key, key: key }));
        outWorksheet.addRows(jsonData);
        
        return await outWorkbook.xlsx.writeBuffer();
    } catch (err) {
        console.error("Merge Error:", err);
        return null;
    } finally {
        if (conn) await conn.close();
        if (db) await db.terminate();
    }
}

self.onmessage = async function(event){
  let mergedFile = await startMerge(event.data.selectedFiles);
  self.postMessage({
    mergedFile: mergedFile
  });
}

