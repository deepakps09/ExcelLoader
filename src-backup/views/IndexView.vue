<script setup>
import {ref,computed,shallowRef,toRaw} from 'vue';
import Validator from '@/components/Validator.vue';
import Merge from '@/components/Merge.vue';

const inputCols = ref([]);
const targetCols = ref([]);
const sourceFile = shallowRef(null);
const mapping = ref({});

// {
//   "target":{
//     "to":"source",
//     "delimiter":"",
//     "ruleSet":{},
//     "mergeSet":{}
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
                delimiter: " ",
                ruleSet: [],
                mergeSet: []
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
    delimiter: " ",
    ruleSet: [],
    mergeSet: []
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
  console.log(mapping.value);
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
                            >
                            <option value="{{null}}">-- Select Source Column --</option>
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
                        <div class="d-flex gap-1">
                          <Merge v-model="mapping[targetCol.index].mergeSet" :availableColumns="inputCols"/>
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
            <div class="card-body bg-white py-5 text-center text-muted">
                mapping examples here
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