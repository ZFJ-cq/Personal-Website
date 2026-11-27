<script setup lang="ts">
import type { TagKind } from '@/db/types'

withDefaults(defineProps<{ name: string; kind?: TagKind; active?: boolean }>(), {
  kind: 'tech',
  active: false,
})
</script>

<template>
  <span class="chip" :class="active ? 'is-active' : `chip-${kind}`">{{ name }}</span>
</template>
