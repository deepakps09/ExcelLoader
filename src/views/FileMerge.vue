<script setup>
import { ref, computed, onMounted } from 'vue';
import ExcelJS from 'exceljs';
import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

// Reactive State
const selectedFiles = ref([]);
const isMerging = ref(false);
const mergeProgress = ref(0);
const statusMessage = ref('');
const showSuccess = ref(false);

let db = null;
let conn = null;

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

const canMerge = computed(() => selectedFiles.value.length > 1 && !isMerging.value);
async function getCSVBuf(file) {
    const fileBuf = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuf);
    const worksheet = workbook.getWorksheet(1);
    const headerRow = worksheet.getRow(1);
    const seenNames = {};
    //handling headers if there are duplicate column names
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
    const csvBuf = await workbook.csv.writeBuffer();
    return new Uint8Array(csvBuf);
}

const startMerge = async () => {
    isMerging.value = true;
    showSuccess.value = false;
    mergeProgress.value = 0;
    
    try {        

        for (let i = 0; i < selectedFiles.value.length; i++) {
            const file = selectedFiles.value[i];
            statusMessage.value = `Converting ${file.name}...`;
            const csvData = await getCSVBuf(file);
            const virtualName = `file_${i}.csv`;
            await db.registerFileBuffer(virtualName, csvData);
            if (i === 0) {
                statusMessage.value = `Creating base table from ${file.name}...`;
                await conn.query(`
                    CREATE OR REPLACE TABLE merged_data AS 
                    SELECT * FROM read_csv_auto('${virtualName}', all_varchar=true)
                `);
            } else {
                statusMessage.value = `Appending ${file.name}...`;
                // union_by_name=True handles mismatched columns safely
                await conn.query(`
                    INSERT INTO merged_data 
                    SELECT * FROM read_csv_auto('${virtualName}', all_varchar=true ,union_by_name=True)
                `);
            }
            mergeProgress.value = Math.round(((i + 1) / selectedFiles.value.length) * 100);
        }

        statusMessage.value = "Finalizing export...";
        await exportResults(conn);
        
        showSuccess.value = true;
        statusMessage.value = "Merge Successful!";
    } catch (err) {
        console.error(err);
        alert("Merge failed. Please make sure both files have the same rows");
        statusMessage.value = "Error: " + err.message;
    } finally {
        isMerging.value = false;
    }
};

const exportResults = async (conn) => {    
    await conn.query("COPY merged_data TO 'output.json' (FORMAT JSON, ARRAY TRUE)");
    const jsonBuffer = await db.copyFileToBuffer('output.json');
    const decoder = new TextDecoder('utf-8');
    let jsonData = JSON.parse(decoder.decode(jsonBuffer));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet 1');
    //setting column headers
    worksheet.columns = Object.keys(jsonData[0]).map(key=>({
        header: key,
        key: key
    }));
    worksheet.addRows(jsonData);
    
    const xlsxbuf = await workbook.xlsx.writeBuffer();
    
    const blob = new Blob([xlsxbuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `merged_report_${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
};

// UI Helpers
const handleFileSelection = (event) => {
    selectedFiles.value = Array.from(event.target.files);
    showSuccess.value = false;
    mergeProgress.value = 0;
};

const reset = () => {
    selectedFiles.value = [];
    showSuccess.value = false;
    statusMessage.value = '';
    mergeProgress.value = 0;
};

const removeFile = (index) => {
    selectedFiles.value.splice(index,1);
}
</script>

<template>
  <div class="container py-5">
    <div class="row justify-content-center">
      <div class="col-lg-8">
        
        <div class="text-center mb-5">
          <h2 class="display-6 fw-bold text-primary">Table Merger</h2>
          <p class="text-muted">Combine multiple XLSX files into a single dataset using DuckDB</p>
        </div>

        <div class="card shadow-sm border-0">
          <div class="card-body p-4">
            
            <div class="mb-4">
              <label for="fileInput" class="form-label fw-bold">Select Excel Files</label>
              <div class="input-group">
                <input 
                  type="file" 
                  class="form-control" 
                  id="fileInput" 
                  multiple 
                  accept=".xlsx"
                  @change="handleFileSelection"
                  :disabled="isMerging"
                >
                <button class="btn btn-outline-secondary" type="button" @click="reset" :disabled="isMerging">
                  Clear All
                </button>
              </div>
              <div class="form-text mt-2">
                All files should ideally have the same columns 
              </div>
            </div>

            <div  class="mb-4">
              <h6 class="border-bottom pb-2">Queue ({{ selectedFiles.length }} files)</h6>
              <ul class="list-group list-group-flush" style="max-height: 250px; overflow-y: auto;">
                <li v-for="(file, index) in selectedFiles" :key="index" 
                    class="list-group-item d-flex justify-content-between align-items-center px-0">
                  <div class="d-flex align-items-center">
                    <i class="bi bi-file-earmark-excel text-success me-2"></i>
                    <span class="small text-truncate" style="max-width: 300px;">{{ file.name }}</span>
                    <span class="badge bg-light text-dark ms-2 border">{{ (file.size / 1024).toFixed(1) }} KB</span>
                  </div>
                  <button v-if="!isMerging" @click="removeFile(index)" class="btn btn-link text-danger p-0">
                    <small>Remove</small>
                  </button>
                </li>
              </ul>
            </div>

            <div v-if="isMerging || showSuccess" class="mb-4">
              <div class="d-flex justify-content-between mb-1">
                <span class="small fw-bold">{{ statusMessage }}</span>
                <span v-if="isMerging" class="small text-muted">{{ mergeProgress }}%</span>
              </div>
              <div class="progress" style="height: 10px;">
                <div 
                  class="progress-bar progress-bar-striped progress-bar-animated bg-primary" 
                  role="progressbar" 
                  :style="{ width: mergeProgress + '%' }"
                ></div>
              </div>
            </div>

            <div v-if="showSuccess" class="alert alert-success d-flex align-items-center" role="alert">
              <div>
                <strong>Success!</strong> All files merged successfully.
              </div>
            </div>

            <div class="d-grid gap-2 d-md-flex justify-content-md-end">
              <button 
                class="btn btn-primary btn-lg px-5" 
                :disabled="!canMerge"
                @click="startMerge"
              >
                <span v-if="isMerging" class="spinner-border spinner-border-sm me-2"></span>
                {{ isMerging ? 'Processing...' : 'Merge Files' }}
              </button>
            </div>

          </div>
        </div>

        <div class="mt-4 text-center">
          <p class="small text-muted">
            <i class="bi bi-info-circle me-1"></i>
            Data is processed locally in your browser. No files are uploaded to any server.
          </p>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  border-radius: 12px;
}
.list-group-item {
  background: transparent;
}
/* For scrolling the file list */
ul::-webkit-scrollbar {
  width: 6px;
}
ul::-webkit-scrollbar-thumb {
  background: #e0e0e0;
  border-radius: 10px;
}
</style>