import ExcelJs from 'exceljs';
import { validateCell } from './ruleValidator';
import { cellTransformer } from './cellTransformer';

self.onmessage=async function(event){    
    let fileArrayBuf = event.data.fileArrayBuf;;
    let mappings = event.data.mappings;
    let targetCols = event.data.targetCols;
    let rowSlicer = event.data.rowSlicer;

    let valErrors = {}; //track total validation errors
    let uniqueTrackers = {}; //this is used to detect whether the cells are unique or not
    let currentErrors = []; //array to track validation errors for each row, cleared after each row has been processed

    for(let i in mappings){
        if(mappings[i].isUnique) uniqueTrackers[i] = new Set(); //initialize a set for each unique column instance
    }

    const sourceWorkbook = new ExcelJs.Workbook();
    const targetWorkbook = new ExcelJs.Workbook();
    try{
        await sourceWorkbook.xlsx.load(fileArrayBuf);
        const sourceWorksheet = sourceWorkbook.getWorksheet(1);
        const targetWorksheet = targetWorkbook.addWorksheet('Sheet 1');
        //setting headers
        for(let i of targetCols){
            targetWorksheet.getRow(1).getCell(Number(i.index)).value = i.label;
        }
        let currentRow = 2; //this is to select the target file's subsequent rows. we already wrote the first row with headers
        sourceWorksheet.eachRow(function(row,rowNumber){            
            if(!(rowNumber > 1 && rowSlicer && rowNumber >= rowSlicer.start && rowNumber <= rowSlicer.end)){
                //skip
                //here, we skip the header row, and the rows outside the slicer range (if any)
            }
            else{
                let targetRow = targetWorksheet.getRow(currentRow);
                for(let i in mappings){
                    //initially, this string will hold either the cell value, or an empty string if there is a merge rule
                    let rowData = mappings[i].to === null ? "" : row.getCell(Number(mappings[i].to)).value;

                   //merge functionality, triggered if the mergeset isnt empty
                    if(mappings[i].mergeSet.length > 0){
                        let mergedRow = [];
                        mappings[i].mergeSet.forEach((col) => {
                            mergedRow.push(`${row.getCell(Number(col)).value}`);
                        });
                        //empty string as the join delimiter will default to ,
                        rowData = mergedRow.join( mappings[i].delim || ' ' );
                    }

                    //transform rules functionality, triggered if the transformset isnt empty
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
                                    column: i,
                                    type: rule.type,
                                    opt: rule.options
                                });
                            }
                        });
                    }
                    //we write the string into the target cell, and mark it as red in the case of any validation failure
                    const targetCell = targetRow.getCell(Number(i));
                    targetCell.value = rowData;
                    if(currentErrors.length > 0){
                        targetCell.fill = {type: 'pattern',pattern: 'solid',fgColor: { argb: 'FFFFC7CE' },};                        
                    }

                    //uniqueness criteria, mark as yellow if cell is a duplicate
                    if(mappings[i].isUnique){
                        if(uniqueTrackers[i].has(rowData)){
                            targetCell.fill = {type: 'pattern',pattern: 'solid',fgColor: { argb: 'FFE0FA5F' },};
                            currentErrors.push({
                                column: i,
                                type: 'isPk',
                                opt: {}
                            });
                        }
                        else uniqueTrackers[i].add(rowData); //if not in the set, add
                    }
                    
                    //push all errors into the global error array
                    if(currentErrors.length > 0) valErrors[rowNumber] = [...currentErrors];

                }
                currentErrors.length = 0; //clearing the current validation error array after pushing to the global error array, reset for the next iteration
                targetRow.commit();
                currentRow += 1;
            }
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