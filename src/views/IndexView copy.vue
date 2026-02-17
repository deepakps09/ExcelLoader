<script setup>
import {ref,computed,shallowRef,toRaw} from 'vue';
import Validator from '@/components/Validator.vue';
import Merge from '@/components/Merge.vue';

const inputCols = ref([]);
const targetCols = ref([]);
const sourceFile = shallowRef(null);
const mapping = ref({});
const ruleSet = ref({});
const mergeSet = ref({});

const areMappingsValid = computed(function(){
    let to_mapped = Object.values(mapping.value);
    return ! (to_mapped.length < targetCols.value.length || to_mapped.includes(""));
});

function clearMappings(target_col){
  mapping.value[target_col] = '';
  for(let i of targetCols.value){
    ruleSet.value[i.index] = [];
    mergeSet.value[i.index] = [];
  }
}

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
            ruleSet.value = {};
            for(let i of targetCols.value){
              ruleSet.value[i.index] = [];
              mergeSet.value[i.index] = [];
            }
          }
        }
        else console.log(event.data.error);
      }
      worker.postMessage(payload);
    }
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
  //mappings are of the form {target:source}
  //rulsets are of the form {target:{rule attributes}}
  const worker = new Worker(new URL('../worker/processRows.js', import.meta.url),{type: 'module'});
  const payload = {
    mappings: toRaw(mapping.value),
    file: sourceFile.value,
    targetCols: toRaw(targetCols.value),
    ruleSet: toRaw(ruleSet.value),
    mergeSet: toRaw(mergeSet.value)
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
                            v-if="mergeSet[targetCol.index].length === 0"
                            v-model="mapping[targetCol.index]" 
                            class="form-select"
                            :class="{ 'border-warning': !mapping[targetCol.index] }"
                            >
                            <option value="">-- Select Source Column --</option>
                            <option 
                                v-for="col in inputCols" 
                                :key="col.index" 
                                :value="col.index"
                                :disabled="Object.values(mapping).includes(col.index) && mapping[targetCol.index] !== col.index"
                            >
                                {{ col.label }} {{ (Object.values(mapping).includes(col.index) && mapping[targetCol.index] !== col.index) ? '✓' : '' }}
                            </option>
                            </select>                            
                            <button class="btn btn-outline-secondary" type="button" @click="clearMappings(targetCol.index)">
                            Clear
                            </button>
                        </div>
                        <div class="d-flex gap-1">
                          <Merge v-model="mergeSet[targetCol.index]" :availableColumns="inputCols"/>
                          <Validator v-model="ruleSet[targetCol.index]"/>
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
            <div class="card-body bg-white py-5 text-center text-muted">
                <div v-if="areMappingsValid">
                    <div v-for="key in mapping" :key="key">
                        {{ mapping[key] }} TO {{ key }}
                    </div>
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