import { createRouter, createWebHistory } from 'vue-router';

import IndexView from '@/views/IndexView.vue';
import QueryExcel from '@/views/QueryExcel.vue';
import FileDiff from '@/views/FileDiff.vue';
import FileMerge from '@/views/FileMerge.vue';
import SheetMerge from '@/views/SheetMerge.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path:'/',
      name:'index',
      component: IndexView
    },
    {
      path:'/query-file',
      name:'query_file',
      component: QueryExcel
    },
    {
      path:'/diff-file',
      name:'diff_file',
      component: FileDiff
    },
    {
      path:'/merge-file',
      name:'merge_file',
      component: FileMerge
    },
    {
      path:'/merge-sheet',
      name:'merge_sheet',
      component: SheetMerge
    }
  ],
});

export default router;
