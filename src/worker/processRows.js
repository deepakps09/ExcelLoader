import ExcelJs from 'exceljs';
import { validateCell } from './ruleValidator';
import { cellTransformer } from './cellTransformer';

self.onmessage=async function(event){    
    let fileArrayBuf = await event.data.file.arrayBuffer();
    let mappings = event.data.mappings;
    let targetCols = event.data.targetCols;

    let valErrors = [];

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
                    //initially, this string will hold either the cell value, or an empty string if there is a merge rule
                    let rowData = mappings[i].to === null ? "" : row.getCell(Number(mappings[i].to)).value;
                    //initializing an empty error array
                    let currentErrors = [];

                   //merge functionality, triggered if the mergeset isnt empty
                    if(mappings[i].mergeSet.length > 0){
                        let mergedRow = [];
                        mappings[i].mergeSet.forEach((col) => {
                            mergedRow.push(`${row.getCell(Number(col)).value}`);
                        });
                        rowData = mergedRow.join(mappings[i].delim);
                    }

                    //transform rules functionality, triggered if the transform set isnt empty
                    if(mappings[i].transformSet.length > 0){
                        mappings[i].transformSet.forEach((rule) => {
                            rowData = cellTransformer(rowData,rule);
                        });
                    }
                    
                    //validator rules functionality, triggered if the ruleset isnt empty
                    if(mappings[i].ruleSet.length > 0){
                        mappings[i].ruleSet.forEach((rule) => {
                            const isValid = validateCell(rowData, rule);
                            if(!isValid){
                                if(rule.replacement.trim() !== '') rowData = rule.replacement;
                                currentErrors.push({
                                    "columnIndex": i,
                                    "violatedRule": rule.type
                                });
                            }
                        });
                    }

                    //finally, we write the string into the target cell, and mark it as red in the case of any validation failure
                    const targetCell = targetRow.getCell(Number(i));
                    targetCell.value = rowData;
                    if(currentErrors.length > 0){
                        targetCell.fill = {type: 'pattern',pattern: 'solid',fgColor: { argb: 'FFFFC7CE' },};
                        valErrors.push([...currentErrors]);
                    }

                }
            }
            targetRow.commit();
        });
        const buffer = await targetWorkbook.xlsx.writeBuffer();
        self.postMessage({
            'buffer':buffer.buffer,
            'error': null,
            'validationErrors': valErrors
        });
    }
    catch(error){
        self.postMessage({
            'error':error
        });
    }
}