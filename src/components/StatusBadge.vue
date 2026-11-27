<script setup lang="ts">
import { STATUS_LABEL, type WorkStatus } from '@/db/types'

defineProps<{ status: WorkStatus }>()
</script>

<template>
  <span class="badge" :class="`badge-${status}`">{{ STATUS_LABEL[status] }}</span>
</template>
