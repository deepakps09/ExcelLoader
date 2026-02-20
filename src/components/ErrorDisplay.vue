<script setup>
import { computed } from 'vue';

const validationMessages = {
  isPk: "Unique constraint failed",
  required: "This field is required",
  isEmail: "Invalid email format",
  isNumeric: "Must be a numeric value",
  isLength: (opt) => {
    if (opt.min && opt.max) return `Length must be between ${opt.min} and ${opt.max}`;
    if (opt.min) return `Minimum length is ${opt.min}`;
    if (opt.max) return `Maximum length is ${opt.max}`;
    return "Invalid length";
  },
  contains: (opt) => `Must contain "${opt.seed || ''}"`,
  matches: "Does not match the required pattern",
  isIn: "Value must be one of the allowed options",
  isURL: "Invalid URL format",
  isMobilePhone: "Invalid phone number",
  isDate: "Must be a valid date",
  isAfter: (opt) => `Date must be after ${opt.date}`,
  isBefore: (opt) => `Date must be before ${opt.date}`,
  default: "Validation failed"
};

//logic to sort and slice the error list, to prevent UI clutter
const visibleRowKeys = computed(() => {
  let slicedKeys = Object.keys(props.groupedErrors)
    .sort((a, b) => Number(a) - Number(b))
    .slice(0, 500);
  let slicedArray = {};
  for(let i of slicedKeys){
    slicedArray[i] = props.groupedErrors[i];
  }
  return slicedArray;
});

const props = defineProps({
  // Expecting { "1": [{column:1, type:'...'}], "5": [...] }
  groupedErrors: {
    type: Object,
    required: true
  }
});

// Calculate total count across all rows
const totalErrorCount = computed(() => {
  return Object.values(props.groupedErrors).reduce((acc, curr) => acc + curr.length, 0);
});

function formatRule(errorMes,options) {
  const message = validationMessages[errorMes] || validationMessages.default;

  if (typeof message === 'function') {
    return message(options || {});
  }
  
  return message;
};

function downloadErrorList(){
    let content = '';
  Object.keys(props.groupedErrors)
    .sort((a, b) => Number(a) - Number(b))
    .forEach(row => {
      content += `Row ${row}:\n`;
      props.groupedErrors[row].forEach(err => {
        content += `  - Column ${err.column}: ${formatRule(err.type,err.opt)}\n`;
      });
      content += "\n";
    });
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `error_report_${new Date().getTime()}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

</script>
<template>
  <div class="card border-danger shadow-sm mt-4">
    <div class="card-header text-white d-flex justify-content-between align-items-center" :class="{'bg-danger':totalErrorCount > 0}">
      <h6 class="mb-0">Validation Report</h6>
      <span class="badge bg-white text-danger">{{ totalErrorCount }} Total Issues</span>
    </div>

    <div class="card-body p-0" style="max-height: 500px; overflow-y: auto;">
      <div class="list-group list-group-flush">
        
        <div v-for="(errors, rowNum) in visibleRowKeys" :key="rowNum" class="list-group-item p-3">
          <div class="d-flex align-items-center mb-2">
            <span class="badge bg-dark me-2">Row #{{ rowNum }}</span>
            <small class="text-muted">{{ errors.length }} issue(s) detected</small>
          </div>

          <div class="ps-3 border-start border-danger border-3">
            <div v-for="(err, idx) in errors" :key="idx" class="d-flex align-items-center mb-1">
              <span class="text-secondary fw-bold small me-2" style="min-width: 80px;">
                Col {{ err.column }}:
              </span>
              <span class="text-danger small">
                <i class="bi bi-x-circle me-1"></i> {{ formatRule(err.type,err.opt) }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="Object.keys(groupedErrors).length === 0" class="text-center py-5">
          <p class="text-success mb-0">No errors found in this file!</p>
        </div>
      </div>      
    </div>
    <div class="container p-1" v-if="totalErrorCount > 500">
        <button class="btn btn-danger" @click="downloadErrorList">Download full error list</button>
    </div>
  </div>
</template>