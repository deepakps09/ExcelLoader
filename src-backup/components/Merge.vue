<script setup>
import { ref } from 'vue';

const mergeList = defineModel({ type: Array, default: () => [] });

const props = defineProps({
  availableColumns: {
    type: Array, // [{letter, index, label}]
    required: true
  }
});

// Manual visibility control for the modal
const isVisible = ref(false);
const selectedColIndex = ref('');

const addColumn = () => {
  if (selectedColIndex.value !== '') {
    mergeList.value.push(Number(selectedColIndex.value));
    selectedColIndex.value = ''; 
  }
};

const removeColumn = (index) => {
  mergeList.value.splice(index, 1);
};

const getColumnDetails = (idx) => {
  return props.availableColumns.find(c => c.index === idx) || { label: 'Unknown', letter: '?' };
};
</script>

<template>
  <div class="d-flex align-items-center gap-2">
    <button 
      @click="isVisible = true" 
      class="btn btn-sm" 
      :class="mergeList.length ? 'btn-primary' : 'btn-outline-primary'"
    >
      <i class="bi bi-intersect"></i> 
      Merge ({{ mergeList.length }})
    </button>    
  </div>

  <div v-if="isVisible" class="custom-modal-wrapper">
    <div class="modal-backdrop fade show"></div>

    <div class="modal fade show d-block" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content shadow-lg">
          
          <div class="modal-header bg-primary text-white">
            <h5 class="modal-title">Merge Rules</h5>
            <button type="button" class="btn-close btn-close-white" @click="isVisible = false"></button>
          </div>

          <div class="modal-body p-4">
            <p class="text-muted small mb-3">
              Select columns in the order you want them to be combined.
            </p>

            <div class="column-sequence-box border rounded p-3 mb-4 bg-light">
              <div v-if="mergeList.length === 0" class="text-center text-muted small py-2">
                No columns selected.
              </div>
              <div class="d-flex flex-column gap-2">
                <div 
                  v-for="(colIdx, i) in mergeList" 
                  :key="i"
                  class="d-flex align-items-center bg-white border rounded p-2 shadow-sm"
                >
                  <span class="badge bg-primary me-2">{{ i + 1 }}</span>
                  <span class="flex-grow-1 fw-bold">
                    {{ getColumnDetails(colIdx).label }} 
                    <small class="text-muted">({{ getColumnDetails(colIdx).letter }})</small>
                  </span>
                  <button @click="removeColumn(i)" class="btn btn-link text-danger p-0 border-0">
                    Remove
                  </button>
                </div>
              </div>
            </div>

            <div class="row g-2">
              <div class="col-9">
                <select v-model="selectedColIndex" class="form-select">
                  <option value="" disabled>Choose source column...</option>
                  <option 
                    v-for="col in availableColumns" 
                    :key="col.index" 
                    :value="col.index"
                  >
                    [{{ col.letter }}] {{ col.label }}
                  </option>
                </select>
              </div>
              <div class="col-3">
                <button 
                  @click="addColumn" 
                  class="btn btn-primary w-100" 
                  :disabled="selectedColIndex === ''"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div class="modal-footer border-0">
            <button class="btn btn-outline-secondary" @click="isVisible = false">Cancel</button>
            <button class="btn btn-primary px-4" @click="isVisible = false">Apply Merge</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-modal-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1050;
}

.modal.show.d-block {
  background: rgba(0, 0, 0, 0.4);
}

.truncate-text {
  max-width: 150px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.column-sequence-box {
  min-height: 80px;
}
</style>