<script setup>
import {ref,shallowRef,toRaw} from 'vue';
import Validator from '@/components/Validator.vue';
import Merge from '@/components/Merge.vue';
import Transform from '@/components/Transform.vue';
import Header from '@/components/Header.vue';
import ErrorDisplay from '@/components/ErrorDisplay.vue';
import {startMerge} from '../worker/fileMerge';

const inputCols = ref([]);
const targetCols = ref([]);
const sourceFile = shallowRef(null);
const rowSlicer = ref({start:1,end:2});
const totalRows = ref(1);
const shouldSlice = ref(false);
const shouldMergeSheets = ref(false);
const mapping = ref({});
const isLoading = ref(false);
const validationErrors = ref({});
const configInputField = ref(null);

// {
//   "target":{
//     "isUnique": false,
//     "to":"source",
//     "delimiter":"",
//     "ruleSet":[], //array of objects
//     "mergeSet":[], //normal array
//     "transformSet":[] //array of objects
//   },
// ...
// }

//read column names
async function onFileLoad(e,inputSource){
    //here, we extract the columns
    isLoading.value = true;
    let file = null;
    if(inputSource === 'source' && e.target.files.length > 1){
      file = await startMerge({mergeSheets: 'true', value: e.target.files}); //here, we require all rows, for setting the maximum row limit
    }
    else file = await e.target.files[0].arrayBuffer();
    if(file){
      const worker = new Worker(new URL('../worker/readColumns.js', import.meta.url),{type: 'module'});
      const payload = {
        file: file
      }
      worker.onmessage = function(event){
        if(event.data.error === null){
          if(inputSource === 'source'){    
            sourceFile.value = file;
            inputCols.value = event.data.headers;
            rowSlicer.value.start = 1;
            rowSlicer.value.end = totalRows.value = event.data.rowCount;
          }
          else{
            targetCols.value = event.data.headers;
            for(let i of targetCols.value){
              mapping.value[i.index]={
                isUnique: false,
                to: null,
                delimiter: "",
                ruleSet: [],
                mergeSet: [],
                transformSet: []
              }
            }
          }
        }
        else console.log(event.data.error);
      }
      worker.postMessage(payload);
    }
  isLoading.value = false;
}
function clearMappings(index){
  mapping.value[index]={
    isUnique: false,
    to: null,
    delimiter: "",
    ruleSet: [],
    mergeSet: [],
    transformSet: []
  }
}
function getColumnDetails(idx,colType) {
  //converting idx to string due to datatype mismatch, depending on whether idx is a key or a value in an object
  if(colType === 'target') return targetCols.value.find(c => String(c.index) === String(idx)) || { label: 'Unknown', letter: '?' };
  return inputCols.value.find(c => String(c.index) === String(idx)) || { label: 'Unknown', letter: '?' };
}
function downloadBlob(buffer, filename) {
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
function saveConfig(){
  const mappingConfig = {
    shouldSlice: shouldSlice.value,
    rowSlicer: toRaw(rowSlicer.value),
    mapping: toRaw(mapping.value)
  };
  const jsonString = JSON.stringify(mappingConfig);
  const encoder = new TextEncoder();
  downloadBlob(encoder.encode(jsonString).buffer,'MappingConfig.json');

}
function loadConfig(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const rawText = e.target.result;
      const mappingConfig = JSON.parse(rawText);      
      if(mappingConfig.shouldSlice){
        shouldSlice.value = mappingConfig.shouldSlice;
        rowSlicer.value.start = mappingConfig.rowSlicer.start;
        rowSlicer.value.end = mappingConfig.rowSlicer.end;
      }
      mapping.value = mappingConfig.mapping;
    } catch (error) {
      console.error("Error parsing JSON:", error);
      mapping.value.length = 0;
    }
  };
  reader.readAsText(file);
};

async function beginMapping(){
  isLoading.value = true;
  const worker = new Worker(new URL('../worker/processRows.js', import.meta.url),{type: 'module'});
  const payload = {
    mappings: toRaw(mapping.value),
    fileArrayBuf: sourceFile.value,
    targetCols: toRaw(targetCols.value),
    rowSlicer: shouldSlice ? toRaw(rowSlicer.value) : null
  }
  worker.onmessage = function(event){
    if(event.data.error === null){
      downloadBlob(event.data.buffer,`mapped_file_${Date.now()}.xlsx`);
      validationErrors.value = event.data.validationErrors;
    }
    else{
      console.log(event.data.error);
      alert("error. please ensure that both the xlsx files, and the mappings are valid ");
    }
    isLoading.value = false;
  }
  worker.postMessage(payload);
}

</script>
<template>
  <Header/>
  <div class="text-center py-5">
    <h2 class="display-6 fw-bold text-primary">Column Mapper</h2>
    <p class="text-muted">Map values in the source column to the target column</p>
  </div>
  <div class="container pb-5">
    <section class="mb-5 p-4 bg-light border rounded shadow-sm">
      <h5 class="mb-4">Upload Files</h5>
      <div class="row">
        <div class="col-md-6 mb-3">
          <label for="fileLeft" class="form-label fw-bold">Source file</label>
          <input class="form-control" @change="onFileLoad($event,'source')" type="file" multiple>
        </div>
        
        <div class="col-md-6 mb-3">
          <label for="fileRight" class="form-label fw-bold">Target template file</label>
          <input class="form-control" @change="onFileLoad($event,'target')" type="file">
        </div>
      </div>
      <div class="row">
        <div class="col-md-6">
          Slice / Select subset:
          <input type="checkbox" :checked="shouldSlice" @change="()=>shouldSlice = !shouldSlice"/>
        </div>
        <div class="col-md-6">
          Merge sheets?:
          <input type="checkbox" :checked="shouldMergeSheets" @change="()=>shouldMergeSheets = !shouldMergeSheets"/>
        </div>
        <template v-if="shouldSlice">
          <div class="col-md-3">
            Starting row:
            <input type="number" class="form-control" :min="1" :max="rowSlicer.end" v-model.number="rowSlicer.start" placeholder="Starting row number"/>          
          </div>
          <div class="col-md-3">
            Ending row:
            <input type="number" class="form-control" :min="rowSlicer.start" :max="totalRows" v-model.number="rowSlicer.end" placeholder="Ending row number"/>
          </div>
        </template>
      </div>
    </section>

    <section>
      <div class="row g-4">
        <div class="col-md-6">
          <div class="card h-100 border-primary">
            <div class="card-header bg-primary text-white">
              Select
            </div>
            <div class="card-body bg-white py-5 text-center text-muted gap-2">
  <div v-if="inputCols.length > 0 && targetCols.length > 0" class="container mt-4">
    
    <div class="row mb-3 pb-2 border-bottom fw-bold text-dark align-items-center">
      <div class="col-md-4 text-start">Destination Columns</div>
      <div class="col-md-6 text-start">Source Columns</div>
      <div class="col-md-2 text-center">Unique?</div>
    </div>

    <div v-for="(targetCol, targetIdx) in targetCols" :key="targetIdx" class="row mb-3 align-items-center border-bottom pb-2">
      
      <div class="col-md-4 fw-bold text-secondary text-start">                          
        {{ targetCol.label }}
      </div>

      <div class="col-md-6">
        <div class="input-group">
          <select
            v-model="mapping[targetCol.index].to" 
            class="form-select"
            :class="{ 'border-warning': !mapping[targetCol.index].to }"
            :disabled="mapping[targetCol.index].mergeSet.length > 0"
          >
            <option :value="null">-- Select Source Column --</option>
            <option 
              v-for="col in inputCols" 
              :key="col.index"
              :value="col.index"
            >
              {{ col.label }}
            </option>
          </select>
          <button class="btn btn-outline-secondary" type="button" @click="clearMappings(targetCol.index)">
            Clear
          </button>                            
        </div>
        
        <div class="d-flex gap-1 justify-content-start mt-1">
          <Transform v-model="mapping[targetCol.index].transformSet"/>
          <Merge v-model:delimiter="mapping[targetCol.index].delim" v-model:mergeList="mapping[targetCol.index].mergeSet" :availableColumns="inputCols"/>
          <Validator v-model="mapping[targetCol.index].ruleSet"/>
        </div>
      </div>

      <div class="col-md-2 text-center">
        <div class="form-check d-inline-block">
          <input 
            class="form-check-input" 
            type="checkbox" 
            v-model="mapping[targetCol.index].isUnique"
            :id="'unique-' + targetIdx"
          >
          <label class="form-check-label small text-muted" :for="'unique-' + targetIdx">
            Unique
          </label>
        </div>
      </div>
    </div>
    <div class="mt-1 d-flex gap-1">
      <button type="button" class="btn btn-primary" @click="saveConfig">Save config</button>
      <input ref="configInputField" type="file" style="display:none" accept=".json" @change="loadConfig"/>
      <button type="button" class="btn btn-primary" @click="()=>configInputField.click()">Load config</button>
    </div>

    <div class="mt-4">
      <button class="btn btn-primary btn-lg" :disabled="isLoading" @click="beginMapping">
        <span v-if="isLoading" class="spinner-border spinner-border-sm me-2" role="status"></span>
        {{ isLoading ? 'Processing...' : 'Start Mapping' }}
      </button>
    </div>
  </div>

  <div v-else>
    Please upload both source and destination files
  </div>
</div>
          </div>
        </div>

        <div class="col-md-6">
          <div class="card h-100 border-success">
            <div class="card-header bg-success text-white">
              Mapping
            </div>
            <div class="card-body bg-white py-5 text-center">
                <div v-for="(value,key) in mapping" :key="key">
                  <span v-if="value.mergeSet.length > 0" class="text-warning">
                    [
                    <span v-for="col in value.mergeSet">
                      {{getColumnDetails(col,'source').label}} {{}}
                    </span>
                     ] MAPPED TO [ {{getColumnDetails(key,'target').label}} ]
                  </span>
                  <span v-else-if="value.to !== null" class="text-success">
                    [ {{getColumnDetails(value.to,'source').label}} ] MAPPED TO [ {{getColumnDetails(key,'target').label}} ]
                  </span>
                  <span v-else class="text-danger">
                    {{getColumnDetails(key,'target').label}} left unmapped
                  </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <ErrorDisplay :groupedErrors="validationErrors"/>
  </div>
</template>

<style scoped>
.card-body {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
</style>