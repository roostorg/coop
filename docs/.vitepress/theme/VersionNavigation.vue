<script setup>
import { useRoute } from 'vitepress';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import VPFlyout from 'vitepress/dist/client/theme-default/components/VPFlyout.vue';

import { versionTarget } from '../version-target.js';

const props = defineProps(['manifest', 'notice']);
const route = useRoute();
const url = ref(null);
const updateUrl = () => {
  url.value = new URL(location.href);
};
onMounted(() => {
  updateUrl();
  window.addEventListener('hashchange', updateUrl);
});
onUnmounted(() => window.removeEventListener('hashchange', updateUrl));
watch(() => route.path, updateUrl, { flush: 'post' });
const current = computed(
  () => route.path.slice(props.manifest.base.length).split('/')[0],
);
const label = (name) =>
  name === 'latest'
    ? 'Development'
    : `${name}${name === props.manifest.stable ? ' · Stable' : name.includes('-') ? ' · Prerelease' : ''}`;
const target = (name) =>
  props.manifest.versions[0].pages
    ? versionTarget(props.manifest, name, route.path, url.value?.hash ?? '')
    : `${props.manifest.base}${name}/`;
const missing = computed(() => url.value?.searchParams.has('missing-page'));
const message = computed(() =>
  current.value === props.manifest.stable
    ? ''
    : current.value === 'latest'
      ? 'Development documentation — these features may not be released yet.'
      : current.value.includes('-')
        ? `You are reading prerelease documentation (${current.value}).`
        : `You are reading an older version of the documentation (${current.value}).`,
);
</script>

<template>
  <template v-if="notice">
    <aside
      v-if="message || missing"
      class="coop-version-notice"
      aria-label="Documentation version notice"
    >
      <span
        >{{ message
        }}<template v-if="missing">
          That page is not available in this version. Here is its
          introduction.</template
        ></span
      >
      <a v-if="current !== manifest.stable" :href="target(manifest.stable)"
        >Read stable docs ({{ manifest.stable }}) →</a
      >
    </aside>
  </template>
  <VPFlyout
    v-else
    class="coop-versions"
    :button="label(current)"
    :label="`Documentation version: ${label(current)}`"
  >
    <nav aria-label="Documentation versions">
      <a
        v-for="{ name } in manifest.versions"
        :key="name"
        :href="target(name)"
        :aria-current="name === current ? 'true' : undefined"
        >{{ label(name) }}</a
      >
    </nav>
  </VPFlyout>
</template>
