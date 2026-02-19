<script setup>
import { ref, computed, onMounted } from 'vue';
import ExcelJS from 'exceljs';
import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import Header from '@/components/Header.vue';

let db = null;
let conn = null;

const file = ref(null);
const workbook = ref(null);
const sheetList = ref([]); // Array of objects { name: string, rowCount: number, selected: boolean }
const isScanning = ref(false);
const isMerging = ref(false);

const selectedSheets = computed(() => sheetList.value.filter(s => s.selected));
const canMerge = computed(() => selectedSheets.value.length > 1 && !isMerging.value);
const allSelected = computed({
  get: () => sheetList.value.length > 0 && sheetList.value.every(s => s.selected),
  set: (val) => sheetList.value.forEach(s => s.selected = val)
});

onMounted(async () => {
    const MANUAL_BUNDLES = {
    mvp: {
        mainModule: duckdb_wasm,
        mainWorker: mvp_worker,
    },
    eh: {
        mainModule: duckdb_wasm_eh,
        mainWorker: eh_worker,
    },
  };
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
  const worker = new Worker(bundle.mainWorker);
  const logger = new duckdb.ConsoleLogger();
  
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  conn = await db.connect();
});

async function handleFileUpload(event){
  const uploadedFile = event.target.files[0];
  if (!uploadedFile) return;

  file.value = uploadedFile;
  isScanning.value = true;
  sheetList.value = [];

  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await uploadedFile.arrayBuffer());
    workbook.value = wb;
    sheetList.value = wb.worksheets.map(ws => ({
      name: ws.name,
      rowCount: ws.actualRowCount,
      selected: true
    }));
  } catch (error) {
    alert("Error reading Excel file: " + error.message);
  } finally {
    isScanning.value = false;
  }
};

async function startMerge(){
  isMerging.value = true;
  try{  
    console.log("Merging these sheets:", selectedSheets.value.map(s => s.name));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.value.arrayBuffer());
    for (let i = 0; i < sheetList.value.length; i++) {
        const sheet = sheetList.value[i];
        if (!sheet.selected) continue;
        const worksheet = workbook.getWorksheet(sheet.name);
        if (!worksheet || worksheet.actualRowCount === 0) continue;
        let csvBuf = await workbook.csv.writeBuffer({ sheetId: worksheet.id });
        await db.registerFileBuffer(`sheet_${i}.csv`, new Uint8Array(csvBuf));
        if (i === 0) {
            //create a table for the first sheet, and for everything else, merge
        await conn.query(`CREATE TABLE merged AS SELECT * FROM read_csv_auto('sheet_${i}.csv', all_varchar=True)`);
        } else {
        await conn.query(`INSERT INTO merged SELECT * FROM read_csv_auto('sheet_${i}.csv', all_varchar=True, union_by_name=True)`);
        }
        csvBuf = null;
    }
    await conn.query("COPY merged TO 'output.json' (FORMAT JSON, ARRAY TRUE)");
    let jsonBuffer = await db.copyFileToBuffer('output.json');
    const decoder = new TextDecoder('utf-8');
    let jsonData = JSON.parse(decoder.decode(jsonBuffer));
    jsonBuffer = null;

    const newWorkbook = new ExcelJS.Workbook();
    const newWorksheet = newWorkbook.addWorksheet('Sheet 1');
    //setting column headers
    newWorksheet.columns = Object.keys(jsonData[0]).map(key=>({
        header: key,
        key: key
    }));
    newWorksheet.addRows(jsonData);
    const xlsxbuf = await newWorkbook.xlsx.writeBuffer();    
    const blob = new Blob([xlsxbuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `merged_sheets_${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }
  catch(error){
    alert("error merging");
    console.log(error);
  }
  finally{
    isMerging.value = false;
  }
};
</script>

<template>
  <Header/>
  <div class="container py-5">
    <div class="row justify-content-center">
      <div class="col-lg-10">
        
        <div class="text-center mb-5">
          <h2 class="display-6 fw-bold text-primary">Sheet Merger</h2>
          <p class="text-muted">Combine multiple XLSX sheets into a single one</p>
        </div>

        <div class="card shadow-sm mb-4">
          <div class="card-body">
            <label class="form-label fw-bold">Step 1: Upload Excel File</label>
            <input 
              type="file" 
              class="form-control form-control-lg" 
              accept=".xlsx" 
              @change="handleFileUpload"
              :disabled="isScanning || isMerging"
            />
          </div>
        </div>

        <div v-if="isScanning" class="text-center p-5">
          <div class="spinner-border text-primary" role="status"></div>
          <p class="mt-2">Scanning workbook for sheets...</p>
        </div>

        <div v-else-if="sheetList.length > 0" class="card shadow-sm mb-4">
          <div class="card-header bg-white d-flex justify-content-between align-items-center py-3">
            <h5 class="mb-0">Step 2: Select Sheets to Combine</h5>
            <div class="form-check">
              <input class="form-check-input" type="checkbox" v-model="allSelected" id="selectAll">
              <label class="form-check-label fw-bold" for="selectAll">Select All</label>
            </div>
          </div>
          
          <div class="list-group list-group-flush">
            <div v-for="sheet in sheetList" :key="sheet.name" class="list-group-item d-flex align-items-center">
              <input 
                class="form-check-input me-3" 
                type="checkbox" 
                v-model="sheet.selected"
                :id="sheet.name"
              >
              <label class="form-check-label d-flex justify-content-between w-100" :for="sheet.name">
                <span>{{ sheet.name }}</span>
                <span class="text-muted small">{{ sheet.rowCount }} rows detected</span>
              </label>
            </div>
          </div>

          <div class="card-footer bg-light p-3 d-flex justify-content-between align-items-center">
            <span class="text-primary fw-bold">
              {{ selectedSheets.length }} sheets selected
            </span>
            <button 
              class="btn btn-success px-4" 
              :disabled="!canMerge"
              @click="startMerge"
            >
              <span v-if="isMerging" class="spinner-border spinner-border-sm me-2"></span>
              Merge Selected Sheets
            </button>
          </div>
        </div>

        <div v-else-if="!file" class="text-center py-5 border rounded-3 bg-light border-dashed">
          <i class="bi bi-file-earmark-arrow-up display-1 text-muted"></i>
          <p class="mt-3">Upload a file to see available worksheets</p>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.border-dashed {
  border-style: dashed !important;
  border-width: 2px !important;
}
.list-group-item:hover {
  background-color: #f8f9fa;
}
</style>