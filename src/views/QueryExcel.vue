<script setup>
import { ref, onMounted } from 'vue';
import ExcelJs from 'exceljs';
import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

// State
const loading = ref(false);
const isDbReady = ref(false);
const query = ref('SELECT * FROM data LIMIT 5');
const columns = ref([]);
const resultText = ref('');
let db = null;
let conn = null;
let data = null;

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
  isDbReady.value = true;
});

const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  loading.value = true;
  try {
    let fileBuf = await file.arrayBuffer();
    const excelWorkbook = new ExcelJs.Workbook();
    await excelWorkbook.xlsx.load(fileBuf);
    const csvBuf = await excelWorkbook.csv.writeBuffer({
      sheetId:1,
      formatterOptions:{
        delimiter: ',',
        quote: '"'
      }
    });

    await db.registerFileBuffer('data.csv',new Uint8Array(csvBuf));
    
    //await db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
    await conn.query(`CREATE OR REPLACE TABLE data AS SELECT * FROM read_csv_auto('data.csv',sample_size=-1,ignore_errors=true)`);
    const meta = await conn.query(`DESCRIBE data`);
    columns.value = meta.toArray().map(row => ({
      column_name: row.column_name,
      column_type: row.column_type
    }));
    
    resultText.value = `File "${file.name}" loaded successfully into table 'data'.`;
  } catch (e) {
    resultText.value = `Error: ${e.message}`;
  } finally {
    loading.value = false;
  }
};

const runQuery = async () => {
  if (!conn) return;
  try {
    let res = await conn.query(query.value);
    //Convert Arrow results to JSON string
    //handle big ints, because JSON.stringify throws an error, convert into strings
    res = res.toArray();
    const cleanRows = res.map(row => {
        const obj = { ...row };
        for (const key in obj) {
            if (typeof obj[key] === 'bigint') {
                obj[key] = obj[key].toString();
            }
        }
        return obj;
    });
    resultText.value = JSON.stringify(cleanRows, null, 2);
    data = cleanRows;
  } catch (e) {
    resultText.value = `Query Error: ${e.message}`;
  }
};

async function saveFile(){
    if(data===null) return;
    const workbook = new ExcelJs.Workbook();
    const worksheet = workbook.addWorksheet('Sheet 1');
    //setting column headers
    worksheet.columns = Object.keys(data[0]).map(key=>({
        header: key,
        key: key
    }));
    worksheet.addRows(data);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `subset_xlsx_${Date.now()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

</script>

<template>
  <div class="container mt-5">
    <header class="mb-4">
      <h1 class="display-5 fw-bold text-primary">DuckDB + Vue Excel Explorer</h1>
      <p class="text-muted">Upload an Excel/CSV file and query it with SQL locally.</p>
    </header>

    <div class="row g-4">
      <div class="col-md-4">
        <div class="card shadow-sm mb-4">
          <div class="card-header bg-light fw-bold">1. Load Data</div>
          <div class="card-body">
            <input type="file" class="form-control" @change="handleFileUpload" accept=".csv, .xlsx" />
            <div v-if="loading" class="mt-3 text-center">
              <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
              <span class="ms-2">Processing...</span>
            </div>
          </div>
        </div>

        <div class="card shadow-sm">
          <div class="card-header bg-light fw-bold">Table Metadata</div>
          <div class="card-body p-0">
            <ul class="list-group list-group-flush" v-if="columns.length">
              <li v-for="col in columns" :key="col.column_name" class="list-group-item d-flex justify-content-between align-items-center">
                <code>{{ col.column_name }}</code>
                <span class="badge bg-secondary rounded-pill">{{ col.column_type }}</span>
              </li>
            </ul>
            <div v-else class="p-3 text-muted small">No file loaded yet.</div>
          </div>
        </div>
      </div>

      <div class="col-md-8">
        <div class="card shadow-sm mb-4">
          <div class="card-header bg-primary text-white fw-bold">2. SQL Query</div>
          <div class="card-body">
            <textarea 
              v-model="query" 
              class="form-control mb-3 family-monospace" 
              rows="4" 
              placeholder="SELECT * FROM data LIMIT 10">
            </textarea>
            <button @click="runQuery" class="btn btn-success w-100" :disabled="!isDbReady">
              Execute Query
            </button>
          </div>
        </div>

        <div class="card shadow-sm">
          <div class="card-header bg-light fw-bold">Query Results</div>
          <div class="card-body">
            <textarea 
              class="form-control bg-dark text-success" 
              rows="12" 
              readonly 
              :value="resultText"
              placeholder="Results will appear here...">
            </textarea>
            <button :disabled="!data || data.length === 0" @click="saveFile" type="button" class="btn btn-success mt-1">Download subset</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
textarea {
  font-family: 'Courier New', Courier, monospace;
}
.card {
  border-radius: 8px;
}
</style>