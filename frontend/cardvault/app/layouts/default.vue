<template>
  <div class="app-shell">
    <CommonAppHeader variant="app" />

    <div class="app-shell__body">
      <CommonAppSidebar class="app-shell__sidebar" />
      <main id="main-content" class="app-shell__main" tabindex="-1">
        <div class="page">
          <slot />
        </div>
      </main>
    </div>

    <CommonAppFooter />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.app-shell__body {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}
.app-shell__sidebar {
  display: none;
}
.app-shell__main {
  min-width: 0;
  padding-block: var(--space-6) var(--space-12);
}

@media (min-width: 40rem) {
  .app-shell__main {
    padding-block: var(--space-8) var(--space-16);
  }
}

@media (min-width: 64rem) {
  .app-shell__body {
    grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  }
  .app-shell__sidebar {
    display: flex;
    position: sticky;
    top: var(--header-height);
    align-self: start;
    height: calc(100vh - var(--header-height));
    overflow-y: auto;
  }
}
</style>
