<script setup>
import { ref, computed, onMounted } from 'vue';
import ExcelJs from 'exceljs';
import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

const fileA = ref(null);
const fileB = ref(null);
const processing = ref(false);
const statusMessage = ref('');
const comparisonDone = ref(false);
const diffResults = ref([]);
const tableHeaders = ref([]);

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

const readyToCompare = computed(() => {
  return fileA.value && fileB.value && !processing.value;
});

async function getCSVBuf(file) {
    let returnVal = {
        csvBuf: null,
        tableHeaders: null
    };
    const fileBuf = await file.arrayBuffer();
    const excelWorkbook = new ExcelJs.Workbook();
    await excelWorkbook.xlsx.load(fileBuf);
    const worksheet = excelWorkbook.getWorksheet(1);
    const headerRow = worksheet.getRow(1).values;
    returnVal.tableHeaders = headerRow.slice(1);
    const csvBuf = await excelWorkbook.csv.writeBuffer({
      sheetId: 1
    });
    returnVal.csvBuf = new Uint8Array(csvBuf);
    return returnVal;
}

async function handleFileA(event){
    processing.value = true;
    try{
        fileA.value = event.target.files[0];    
        let returnVal = await getCSVBuf(fileA.value);
        tableHeaders.value = returnVal.tableHeaders;
        await db.registerFileBuffer('fileA.csv',returnVal.csvBuf);
        await conn.query(`CREATE OR REPLACE TABLE dataA AS SELECT * FROM read_csv_auto('fileA.csv',sample_size=-1,ignore_errors=true)`);
    }
    catch(error){
        statusMessage.value = error.message;
        console.log(error);
    }
    finally{
        processing.value = false;
    }
    
};

async function handleFileB(event){
    processing.value = true;
    try{
        fileB.value = event.target.files[0];    
        let returnVal = await getCSVBuf(fileB.value);
        if (returnVal.tableHeaders.length !== tableHeaders.value.length){
            alert("Columns do not match");
            fileB.value = null;
            return;
        }
        await db.registerFileBuffer('fileB.csv',returnVal.csvBuf);
        await conn.query(`CREATE OR REPLACE TABLE dataB AS SELECT * FROM read_csv_auto('fileB.csv',sample_size=-1,ignore_errors=true)`);
    }
    catch(error){
        statusMessage.value = error.message;
        console.log(error);
    }
    finally{
        processing.value = false;
    }
};

const runComparison = async () => {
  processing.value = true;
  try{
    let res = await conn.query(`
        SELECT 'Added/Changed' as diff_type, * FROM (
            SELECT * FROM dataB EXCEPT ALL SELECT * FROM dataA
        )
        UNION ALL
        SELECT 'Removed/Changed' as diff_type, * FROM (
            SELECT * FROM dataA EXCEPT ALL SELECT * FROM dataB
        )
    `);
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
    diffResults.value = JSON.parse(JSON.stringify(cleanRows,null,2));
  }
  catch(error){

  }
  finally{
    processing.value = false;
  }
};

const clearResults = () => {
  diffResults.value = [];
  comparisonDone.value = false;
  statusMessage.value = '';
};

const getStatusBadgeClass = (type) => {
  return {
    'badge rounded-pill bg-success': type === 'Added',
    'badge rounded-pill bg-danger': type === 'Removed',
    'badge rounded-pill bg-warning text-dark': type === 'Modified'
  };
};
</script>
<template>
  <div class="container mt-5">
    <div class="card shadow-sm">
      <div class="card-header bg-primary text-white">
        <h4 class="mb-0">Data Comparison Tool (DuckDB Powered)</h4>
      </div>
      
      <div class="card-body">
        <div class="row g-4">
          <div class="col-md-6">
            <div class="p-3 border rounded bg-light">
              <label class="form-label fw-bold">Source File (Baseline)</label>
              <input type="file" class="form-control" @change="handleFileA" accept=".xlsx, .csv" />
              <div class="form-text">Select the original version of your data.</div>
            </div>
          </div>

          <div class="col-md-6">
            <div class="p-3 border rounded bg-light">
              <label class="form-label fw-bold">Comparison File (New Version)</label>
              <input type="file" class="form-control" @change="handleFileB" accept=".xlsx, .csv" />
              <div class="form-text">Select the version you want to check for changes.</div>
            </div>
          </div>
        </div>

        <div class="row mt-4 align-items-center">
          <div class="col-auto">
            <button 
              class="btn btn-success px-4" 
              :disabled="!readyToCompare"
              @click="runComparison"
            >
              Run Row-by-Row Diff
            </button>
          </div>
          <div class="col">
            <div v-if="processing" class="spinner-border spinner-border-sm text-primary" role="status"></div>
            <span v-if="statusMessage" class="ms-2 text-muted small">{{ statusMessage }}</span>
          </div>
        </div>

        <hr v-if="diffResults.length > 0" class="my-5" />

        <div v-if="diffResults.length > 0" class="mt-4">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h5>Differences Found ({{ diffResults.length }})</h5>
            <button class="btn btn-outline-secondary btn-sm" @click="clearResults">Clear</button>
          </div>
          
          <div class="table-responsive border rounded">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-dark">
                <tr>
                  <th>Status</th>
                  <th v-for="header in tableHeaders" :key="header">{{ header }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, index) in diffResults" :key="index">
                  <td>
                    <span :class="getStatusBadgeClass(row.diff_type)">
                      {{ row.diff_type }}
                    </span>
                  </td>
                  <td v-for="header in tableHeaders" :key="header">
                    {{ row[header] }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-else-if="comparisonDone" class="alert alert-info mt-4">
          No differences found! Both files are identical at the row level.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table-responsive {
  max-height: 500px;
}
thead th {
  position: sticky;
  top: 0;
  z-index: 1;
}
</style>