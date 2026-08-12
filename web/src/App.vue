<script setup lang="ts">
import { frFR, dateFrFR } from 'naive-ui'
import { themeOverrides } from './theme'
import { useAutoReload } from './useAutoReload'

// intervalle réduit possible depuis les tests e2e (cf. useAutoReload.spec.ts),
// jamais défini en usage réel : `undefined` retombe sur le défaut de 60 s
useAutoReload((window as any).__intervalleAutoReloadTest)
</script>

<template>
  <n-config-provider :theme-overrides="themeOverrides" :locale="frFR" :date-locale="dateFrFR">
    <n-message-provider>
      <n-dialog-provider>
        <router-view />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
