<script setup>
import {ref,shallowRef,toRaw} from 'vue';
import Validator from '@/components/Validator.vue';
import Merge from '@/components/Merge.vue';
import Transform from '@/components/Transform.vue';

const inputCols = ref([]);
const targetCols = ref([]);
const sourceFile = shallowRef(null);
const mapping = ref({});

// {
//   "target":{
//     "to":"source",
//     "delimiter":"",
//     "ruleSet":[], //array of objects
//     "mergeSet":[], //normal array
//     "transformSet":[] //array of objects
//   },
// ...
// }

//read column names
async function onFileLoad(event,inputSource){
    //here, we extract the columns
    let file = event.target.files[0];
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
          }
          else{
            targetCols.value = event.data.headers;
            for(let i of targetCols.value){
              mapping.value[i.index]={
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
}
function clearMappings(index){
  mapping.value[index]={
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
async function beginMapping(){
  const worker = new Worker(new URL('../worker/processRows.js', import.meta.url),{type: 'module'});
  const payload = {
    mappings: toRaw(mapping.value),
    file: sourceFile.value,
    targetCols: toRaw(targetCols.value)
  }
  worker.onmessage = function(event){
    if(event.data.error === null){
      downloadBlob(event.data.buffer,"MappedFile.xlsx");
    }
    else console.log(event.data.error);
  }
  worker.postMessage(payload);
}

</script>
<template>
  <div class="container pb-5">
    <section class="mb-5 p-4 bg-light border rounded shadow-sm">
      <h5 class="mb-4">Upload Files</h5>
      <div class="row">
        <div class="col-md-6 mb-3">
          <label for="fileLeft" class="form-label fw-bold">Source file</label>
          <input class="form-control" @change="onFileLoad($event,'source')" type="file">
        </div>
        
        <div class="col-md-6 mb-3">
          <label for="fileRight" class="form-label fw-bold">Target template file</label>
          <input class="form-control" @change="onFileLoad($event,'target')" type="file">
        </div>
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
                    <div v-for="(targetCol, targetIdx) in targetCols" :key="targetIdx" class="row mb-3 align-items-center border-bottom pb-2">
                        <div class="col-md-5 fw-bold text-secondary">
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
                            <option value="null">-- Select Source Column --</option>
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
                        <div class="d-flex gap-1 justify-content-end mt-1">
                          <Transform v-model="mapping[targetCol.index].transformSet"/>
                          <Merge v-model:delimiter="mapping[targetCol.index].delim" v-model:mergeList="mapping[targetCol.index].mergeSet" :availableColumns="inputCols"/>
                          <Validator v-model="mapping[targetCol.index].ruleSet"/>
                        </div>
                        </div>

                    </div>
                    <button type="button" @click="beginMapping" class="btn btn-primary">Begin</button>
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