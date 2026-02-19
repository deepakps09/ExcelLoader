<template>
    <nav class="container-fluid navbar navbar-expand-lg ">
    <div class="container-fluid">
      <a class="navbar-brand fw-bold text-primary" href="#" @click.prevent>
        <i class="bi bi-layers-half me-2"></i>Mapping utility
      </a>

      <div class="collapse navbar-collapse">
        <ul class="navbar-nav ms-auto mb-2 mb-lg-0">
          <li class="nav-item">
            <router-link class="nav-link" to="/">Map columns</router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" to="/query-file">Query file</router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" to="/diff-file">File difference</router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" to="/merge-sheet">Merge sheets</router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" to="/merge-file">Merge files</router-link>
          </li>          
        </ul>
      </div>
    </div>
  </nav>
</template>