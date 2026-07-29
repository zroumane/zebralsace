<script setup lang="ts">
import { frFR, dateFrFR } from 'naive-ui'
import { themeOverrides } from './theme'
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
