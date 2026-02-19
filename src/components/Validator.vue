<script setup>
import { ref, computed } from 'vue';

const rules = defineModel({ required: true });
const isVisible = ref(false);

const areRulesValid = computed(function(){
  let validity = true;
  for(let rule of rules.value){
    //check for contains unfilled substring
    if(rule.type === 'contains' && rule.options.seed.trim() === ''){
      validity = false;
      break;
    }
    //check for isLength unfilled max and min attributes
    else if(rule.type === 'isLength' && (rule.options.min === '' || rule.options.max === '')){
      validity = false;
      break;
    }
  }
  return validity;
});

const addRule = () => {
  if (!rules.value) rules.value = [];
  rules.value.push({ type: 'required', replacement: '', options: {seed:'', max:'', min:'', locale:'en-IN' } });
};

const removeRule = (index) => {
  rules.value.splice(index, 1);
};

</script>

<template>
  <button 
    @click="isVisible = true" 
    class="btn btn-sm" 
    :class="rules?.length ? 'btn-primary' : 'btn-outline-secondary'"
  >
    Validation ({{ rules?.length || 0 }})
  </button>

  <div v-if="isVisible">
    <div class="modal-backdrop fade show"></div>

    <div class="modal fade show d-block" tabindex="-1" role="dialog">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content shadow-lg">
          
          <div class="modal-header bg-primary">
            <h5 class="modal-title text-light">Validation Rules</h5>
            <button type="button" class="btn-close btn-close-white" :disabled="!areRulesValid" @click="isVisible = false"></button>
          </div>

          <div class="modal-body" style="max-height: 400px; overflow-y: auto;">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <button @click="addRule" class="btn btn-sm btn-success">+ Add Rule</button>
            </div>

            <div v-for="(rule, index) in rules" :key="index" class="card mb-3 border-0 bg-light p-3">
               <div class="row g-2 align-items-center">
                  <div class="col-md-4">
                    <select v-model="rule.type" class="form-select form-select-sm">
                      <option value="required">Required (Not Empty)</option>
                      <option value="isEmail">Must be Email</option>
                      <option value="isNumeric">Must be Numeric</option>
                      <option value="isLength">Length Requirement</option>
                      <option value="contains">Must Contain String</option>
                      <option value="isURL">Must be a URL</option>
                      <option value="isMobilePhone">Must be a phone number</option>
                      <option value="isDate">Must be a date</option>
                    </select>
                  </div>
                  <div class="col-md-5">
                    <div v-if="rule.type === 'isLength'" class="d-flex gap-1">
                      <div>
                        <input type="number" v-model.number="rule.options.min" class="form-control form-control-sm" placeholder="MIN">
                      </div>
                      <div>
                        <input type="number" v-model.number="rule.options.max" class="form-control form-control-sm" placeholder="MAX">
                      </div>
                    </div>

                    <div v-else-if="rule.type === 'contains'">
                      <input type="text" v-model="rule.options.seed" class="form-control form-control-sm" placeholder="Search term">
                    </div>

                    <div v-else-if="rule.type === 'isMobilePhone'">
                      <select class="form-control form-control-sm" v-model="rule.options.locale">
                        <option value="en-IN">+91 (India)</option>
                        <option value="any">Any valid PNO</option>
                      </select>
                    </div>

                    <div class="d-flex gap-1" v-else>
                      <input type="text" v-model="rule.replacement" class="form-control form-control-sm" placeholder="Optional replacement value">
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