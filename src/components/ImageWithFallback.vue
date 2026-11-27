<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    src?: string | null
    alt?: string
    letter?: string
    eager?: boolean
  }>(),
  { src: null, alt: '', letter: '·', eager: false },
)

const attempt = ref(0)
const failed = ref(false)

const current = computed(() => {
  if (!props.src) return ''
  return attempt.value === 0 ? props.src : `${props.src}${props.src.includes('?') ? '&' : '?'}retry=${attempt.value}`
})

watch(
  () => props.src,
  () => {
    attempt.value = 0
    failed.value = false
  },
)

function onError() {
  if (attempt.value < 1) attempt.value += 1
  else failed.value = true
}

const visible = computed(() => !!props.src && !failed.value)
</script>

<template>
  <img
    v-if="visible"
    :src="current"
    :alt="alt"
    :loading="eager ? 'eager' : 'lazy'"
    decoding="async"
    @error="onError"
  />
  <div v-else class="cover-fallback" role="img" :aria-label="alt || '占位封面'">
    <span>{{ letter }}</span>
  </div>
</template>
