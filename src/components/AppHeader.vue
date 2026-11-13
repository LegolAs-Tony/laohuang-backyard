<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const scrolled = ref(false)

function handleScroll(): void {
  scrolled.value = window.scrollY > 4
}

onMounted(() => {
  handleScroll()
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <header id="site-header" class="site-header" :class="{ 'is-scrolled': scrolled }">
    <div class="site-header__inner">
      <div class="brand">
        <span class="brand__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M19 3.6c-8.6.4-13.4 5.2-13.8 13.9 8.6-.4 13.4-5.2 13.8-13.9Z"
              fill="currentColor"
            />
            <path
              d="M4.6 21c.7-3.6 2.3-6.6 4.9-9.2"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
            <path
              d="M6.2 18.4c1.9-3.4 4.4-6 7.7-8"
              stroke="#0A84FF"
              stroke-width="0.9"
              stroke-linecap="round"
              opacity=".55"
            />
          </svg>
        </span>
        <div class="brand__text">
          <h1 class="brand__title">老黄的后花园</h1>
          <p class="brand__subtitle">今天也来后花园坐坐</p>
        </div>
      </div>

      <span class="brand__badge">
        <span class="brand__dot" aria-hidden="true" />
        仅存本机
      </span>
    </div>
  </header>
</template>
