<script setup>
import { ref, computed } from 'vue';

const transform = defineModel({ required: true });
const isVisible = ref(false);

const areRulesValid = computed(function(){
  let validity = true;
  for(let rule of transform.value){
    if(rule.type === 'replaceNull' && rule.options.replacement.trim() === ''){
      validity = false;
      break;
    }
    else if(rule.type === 'replaceAll' && (rule.options.replacement.trim() === '' || rule.options.substr.trim() === '')){
      validity = false;
      break;
    }
  }
  return validity;
});

const addRule = () => {
  if (!transform.value) transform.value = [];
  transform.value.push({ type: 'toUpper',options:{replacement:''}});
};

const removeRule = (index) => {
  transform.value.splice(index, 1);
};

</script>

<template>
  <button 
    @click="isVisible = true" 
    class="btn btn-sm" 
    :class="transform?.length ? 'btn-primary' : 'btn-outline-secondary'"
  >
    Transform ({{ transform?.length || 0 }})
  </button>

  <div v-if="isVisible">
    <div class="modal-backdrop fade show"></div>

    <div class="modal fade show d-block" tabindex="-1" role="dialog">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content shadow-lg">
          
          <div class="modal-header bg-primary">
            <h5 class="modal-title text-light">Transfomation Rules</h5>
            <button type="button" class="btn-close btn-close-white" :disabled="!areRulesValid" @click="isVisible = false"></button>
          </div>

          <div class="modal-body" style="max-height: 400px; overflow-y: auto;">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <button @click="addRule" class="btn btn-sm btn-success">+ Add Rule</button>
            </div>

            <div v-for="(rule, index) in transform" :key="index" class="card mb-3 border-0 bg-light p-3">
               <div class="row g-2 align-items-center">
                  <div class="col-md-4">
                    <select v-model="rule.type" class="form-select form-select-sm">
                      <option value="toUpper">To uppercase</option>
                      <option value="toLower">To lowercase</option>
                      <option value="trim">Remove leading and trailing spaces</option>
                      <option value="replaceNull">Replace empty strings</option>
                      <option value="replaceAll">Replace substring with other</option>
                    </select>
                  </div>
                  <div class="col-md-5">
                    <div v-if="rule.type === 'replaceNull'">
                      <input type="text" v-model="rule.options.replacement" class="form-control form-control-sm" placeholder="Replacement">
                    </div>
                    <div class="d-flex gap-1" v-else-if="rule.type === 'replaceAll'">
                        <input type="text" v-model="rule.options.substr" class="form-control form-control-sm" placeholder="Old substring">
                        <input type="text" v-model="rule.options.replacement" class="form-control form-control-sm" placeholder="Replacement">
                    </div>
                  </div>
                  <div class="col-md-2 text-end">
                    <button @click="removeRule(index)" class="btn btn-sm btn-outline-danger">×</button>
                  </div>
               </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-primary px-4" :disabled="!areRulesValid" @click="isVisible = false">Close & Sync</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Ensure the modal is centered and visible over everything */
.modal.show.d-block {
  background: rgba(0, 0, 0, 0.1); /* Subtle extra layer */
  z-index: 1055;
}
.modal-backdrop {
  z-index: 1050;
}
</style>