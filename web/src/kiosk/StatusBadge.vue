<script setup lang="ts">
import { useStatus } from '../useStatus'

const statut = useStatus()
</script>

<template>
  <div class="badge" :class="statut.pret ? 'ok' : 'ko'" data-testid="statut-imprimante">
    <span class="point" />
    {{ statut.pret ? 'Imprimante connectée' : `Imprimante indisponible : ${statut.message}` }}
  </div>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  font-weight: 700;
}
.ok { background: #e8f5e9; color: #1b5e20; }
.ko { background: #fdecea; color: #780000; }
.point { width: 12px; height: 12px; border-radius: 50%; background: currentColor; }
</style>
