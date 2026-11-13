<script setup lang="ts">
import { computed, ref } from 'vue'
import { MAX_AUTHOR, MAX_CONTENT } from '@/lib/storage'

interface SubmitPayload {
  author: string
  content: string
}

const props = withDefaults(defineProps<{ initialAuthor?: string }>(), {
  initialAuthor: ''
})

const emit = defineEmits<{ submit: [payload: SubmitPayload] }>()

const author = ref(props.initialAuthor)
const content = ref('')
const localError = ref('')
const textarea = ref<HTMLTextAreaElement | null>(null)

const length = computed(() => content.value.length)

const counterClasses = computed(() => ({
  'is-warning': length.value > 400 && length.value <= MAX_CONTENT,
  'is-full': length.value > MAX_CONTENT
}))

const submitDisabled = computed(() => length.value > MAX_CONTENT)

function submit(): void {
  const text = content.value.trim()

  if (!text) {
    localError.value = '院子里不能空着，先写点什么吧。'
    textarea.value?.focus()
    return
  }

  if (text.length > MAX_CONTENT) {
    localError.value = `超过 ${MAX_CONTENT} 字了，删减一点再试。`
    return
  }

  localError.value = ''
  emit('submit', { author: author.value.trim().slice(0, MAX_AUTHOR), content: text })
}

function handleInput(): void {
  if (localError.value) localError.value = ''
}

function handleKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    submit()
  }
}

/** 只有保存成功才由父组件调用，避免保存失败时丢字 */
function reset(): void {
  content.value = ''
  localError.value = ''
}

function focus(): void {
  textarea.value?.focus()
}

defineExpose({ reset, focus })
</script>

<template>
  <section class="composer" aria-labelledby="composer-title">
    <h2 id="composer-title" class="sr-only">种下一条新的动态</h2>

    <form class="composer__form" novalidate @submit.prevent="submit">
      <div class="composer__top">
        <label class="field" for="author">
          <span class="field__label">署名</span>
          <input
            id="author"
            v-model="author"
            class="field__input"
            name="author"
            type="text"
            maxlength="20"
            placeholder="花园访客"
            autocomplete="off"
            spellcheck="false"
          >
        </label>
        <span class="composer__hint">
          <kbd>Ctrl</kbd><span class="composer__slash">/</span><kbd>⌘</kbd>
          <span class="composer__plus">+</span>
          <kbd>Enter</kbd>
          快速种下
        </span>
      </div>

      <label class="sr-only" for="content">动态内容</label>
      <textarea
        id="content"
        ref="textarea"
        v-model="content"
        class="composer__textarea"
        name="content"
        rows="4"
        maxlength="500"
        placeholder="此刻的花园里，是什么样子？"
        spellcheck="false"
        @input="handleInput"
        @keydown="handleKeydown"
      />

      <div class="composer__footer">
        <span id="counter" class="counter" :class="counterClasses">
          <strong id="counter-current">{{ length }}</strong>
          <span class="counter__sep">/</span>
          <span>{{ MAX_CONTENT }}</span>
        </span>
        <button
          id="submit-btn"
          class="btn btn--primary"
          type="button"
          :disabled="submitDisabled"
          @click="submit"
        >
          <span class="btn__label">种下这条</span>
          <svg class="btn__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 19V5m0 0-5.2 5.2M12 5l5.2 5.2"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>

      <p v-if="localError" id="composer-error" class="composer__error" role="alert">
        {{ localError }}
      </p>
    </form>
  </section>
</template>
