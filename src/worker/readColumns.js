import ExcelJs from 'exceljs';

self.onmessage=async function(event){
    let fileArrayBuf = await event.data.file.arrayBuffer();
    let headers = [];
    let err = null;

    const workbook = new ExcelJs.Workbook();
    try{
        await workbook.xlsx.load(fileArrayBuf);
        const worksheet = workbook.getWorksheet(1);
        worksheet.getRow(1).eachCell({includeEmpty:false},function(cell,colNumber){
            //loading available columns and column labels
            headers.push({
                letter: cell.column,
                index: colNumber,
                label: cell.text,
                sample: ""
            });
        });
        /*
        worksheet.getRow(2).eachCell({includeEmpty:false},function(cell){
            headers[headers.length - 1].sample = cell.value; //loading sample data from second row
        });
        */
    }
    catch(error){
        err = error;
    }
    finally{
        self.postMessage({
            'headers': headers,
            'error': err
        });
        self.close();
    }
}