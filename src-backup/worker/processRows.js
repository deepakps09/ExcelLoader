import ExcelJs from 'exceljs';
import { validateCell } from './ruleValidator';

self.onmessage=async function(event){    
    let fileArrayBuf = await event.data.file.arrayBuffer();
    let mappings = event.data.mappings;
    let targetCols = event.data.targetCols;

    let ruleSet = event.data.ruleSet;
    let mergeSet = event.data.mergeSet;
    let transformSet = event.data.transformSet;

    let errors = [];

    //filling unmapped target columns, for merge functionality to work properly
    for(let i of targetCols){
        if(! Object.keys(mappings).includes(String(i.index)) && mergeSet[i.index]) mappings[i.index] = 1;
    }
    const sourceWorkbook = new ExcelJs.Workbook();
    const targetWorkbook = new ExcelJs.Workbook();
    try{
        await sourceWorkbook.xlsx.load(fileArrayBuf);
        const sourceWorksheet = sourceWorkbook.getWorksheet(1);
        const targetWorksheet = targetWorkbook.addWorksheet('Sheet 1');        
        sourceWorksheet.eachRow(function(row,rowNumber){
            let targetRow = targetWorksheet.getRow(rowNumber);
            if(rowNumber === 1){
                 //to write columns
                 //setting through targetWorksheet.columns throws an error at writeBuffer
                for(let i of targetCols){
                    targetRow.getCell(Number(i.index)).value = i.label;
                }
            }
            else{
                //if not the first row, populate with data from the source
                for(let i in mappings){
                    if(! mappings[i]) return;
                    let rowData = row.getCell(Number(mappings[i])).value;

                    //validator functionality
                    ruleSet[i].forEach((rule) => {
                        const isValid = validateCell(rowData, rule);
                        if(!isValid){
                            errors.push({
                                "columnIndex": i,
                                "violatedRule": rule.type
                            });
                        }
                    });

                    //merge functionality
                    let mergedRow = [];
                    mergeSet[i].forEach((col) => {
                        mergedRow.push(`${row.getCell(Number(col)).value}`);
                    });
                    if(mergeSet[i].length > 0) rowData = mergedRow.join(" ");

                    targetRow.getCell(Number(i)).value = rowData;
                    
                }
            }            
            targetRow.commit();
        });
        const buffer = await targetWorkbook.xlsx.writeBuffer();
        self.postMessage({
            'buffer':buffer.buffer,
            'error': null
        });
    }
    catch(error){
        self.postMessage({
            'error':error
        });
    }
}