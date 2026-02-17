<script setup>
import {ref,computed,shallowRef} from 'vue';
import {init} from 'excelize-wasm';

const wasmUrl = "/excelize.wasm";

const inputCols = ref([]);
const targetCols = ref([]);
const sourceFile = shallowRef(null);
const mapping = ref({});

const areMappingsValid = computed(function(){
    let to_mapped = Object.values(mapping.value);
    return ! (to_mapped.length < targetCols.value.length || to_mapped.includes(""));
});

//read column names
async function onFileLoad(event,inputSource){
    //here, we find extract the columns
    let file = event.target.files[0];
    if(file){
        const arrayBuf = await file.arrayBuffer();
        const uint8arr = new Uint8Array(arrayBuf);
        try{
            const lib = await init(wasmUrl); 
            const f = await lib.OpenReader(uint8arr);
            const sheets = await f.GetSheetList();
            const rows = await f.GetRows(sheets.list[0]);
            if(rows.result.length > 0){
                let cols = rows.result[0];
                mapping.value = {};
                if(inputSource === 'source'){
                    sourceFile.value = event.target.files[0];
                    inputCols.value = cols;
                }
                else targetCols.value = cols;
            }
        }
        catch(error){
            console.log(error);
        }
    }
}

async function beginMapping(){
    //copying and flipping the mapping object, converting it into an array
    let maps=JSON.parse(JSON.stringify(mapping.value));
    if(sourceFile.value){
        const arrayBuf = await sourceFile.value.arrayBuffer();
        const uint8arr = new Uint8Array(arrayBuf);
        try{
            const lib = await init(wasmUrl); 
            const f = await lib.OpenReader(uint8arr);
            const sheets = await f.GetSheetList();
            const rows = await f.GetRows(sheets.list[0]);
            if(rows.result.length > 0){
                console.log(rows);
                console.log(mapping);
            }
        }
        catch(error){
            console.log(error);
        }
    }
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
                    <div v-for="(targetName, targetIdx) in targetCols" :key="targetIdx" class="row mb-3 align-items-center border-bottom pb-2">
                        <div class="col-md-5 fw-bold text-secondary">
                        {{ targetName }}
                        </div>
                        <div class="col-md-6">
                        <div class="input-group">
                            <select 
                            v-model="mapping[targetName]" 
                            class="form-select"
                            :class="{ 'border-warning': !mapping[targetName] }"
                            >
                            <option value="">-- Select Source Column --</option>
                            <option 
                                v-for="col in inputCols" 
                                :key="col" 
                                :value="col"
                                :disabled="Object.values(mapping).includes(col) && mapping[targetName] !== col"
                            >
                                {{ col }} {{ (Object.values(mapping).includes(col) && mapping[targetName] !== col) ? '✓' : '' }}
                            </option>
                            </select>
                            
                            <button class="btn btn-outline-secondary" type="button" @click="mapping[targetName] = ''">
                            Clear
                            </button>
                        </div>
                        </div>
                    </div>
                    <button type="button" :disabled="!areMappingsValid" @click="beginMapping" class="btn btn-primary">Begin</button>
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
                        {{ key }} TO {{ mapping[key] }}
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