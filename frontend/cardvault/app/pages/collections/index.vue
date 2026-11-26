<script setup lang="ts">
import type { Collection, Tag } from '~/types/collection'

const {
  collections,
  isLoading: collectionsLoading,
  error: collectionsError,
  fetchCollections,
  createCollection,
  renameCollection,
  deleteCollection,
} = useCollections()
const { tags, isLoading: tagsLoading, error: tagsError, fetchTags, createTag, deleteTag } = useTags()

const loaded = ref(false)
const notice = ref<string | null>(null)

onMounted(async () => {
  await Promise.all([fetchCollections(), fetchTags()])
  loaded.value = true
})

const announce = (message: string) => {
  notice.value = message
}

// --- Collections -------------------------------------------------------------
const newCollectionName = ref('')

const onCreateCollection = async () => {
  const name = newCollectionName.value.trim()
  if (!name) return
  const created = await createCollection(name)
  if (created) {
    newCollectionName.value = ''
    announce(`Collection "${created.name}" created.`)
  }
}

const renamingId = ref<string | null>(null)
const renameValue = ref('')

const startRename = (collection: Collection) => {
  renamingId.value = collection.id
  renameValue.value = collection.name
  notice.value = null
}

const cancelRename = () => {
  renamingId.value = null
}

const onRename = async (collection: Collection) => {
  const name = renameValue.value.trim()
  if (!name || name === collection.name) {
    cancelRename()
    return
  }
  const renamed = await renameCollection(collection.id, name)
  if (renamed) {
    cancelRename()
    announce(`Collection renamed to "${renamed.name}".`)
  }
}

const cardsPhrase = (count: number | undefined) =>
  count === 1 ? '1 card' : `${count ?? 0} cards`

const onDeleteCollection = async (collection: Collection) => {
  const keep = collection.cardCount
    ? ` Its ${cardsPhrase(collection.cardCount)} will stay in your library, without a collection.`
    : ''
  if (!window.confirm(`Delete the collection "${collection.name}"?${keep}`)) return
  if (await deleteCollection(collection.id)) announce(`Collection "${collection.name}" deleted.`)
}

// --- Tags ----------------------------------------------------------------------
const newTagName = ref('')

const onCreateTag = async () => {
  const name = newTagName.value.trim()
  if (!name) return
  const created = await createTag(name)
  if (created) {
    newTagName.value = ''
    announce(`Tag "${created.name}" created.`)
  }
}

const onDeleteTag = async (tag: Tag) => {
  const used = tag.cardCount ? ` It will be removed from ${cardsPhrase(tag.cardCount)}.` : ''
  if (!window.confirm(`Delete the tag "${tag.name}"?${used} The cards themselves are kept.`)) return
  if (await deleteTag(tag.id)) announce(`Tag "${tag.name}" deleted.`)
}
</script>

<template>
  <section>
    <CommonPageHeading
      title="Collections and tags"
      description="Group related cards into collections, and label them with tags, so they are easy to browse together. Both are private to you: they are never published or copied with a card."
    />

    <div class="stack organise" style="--stack-gap: var(--space-10)">
      <CommonAppAlert v-if="notice" variant="success">{{ notice }}</CommonAppAlert>

      <!-- Collections -->
      <section class="stack" style="--stack-gap: var(--space-4)" aria-labelledby="collections-heading">
        <div class="organise__header">
          <h2 id="collections-heading" class="organise__title">Collections</h2>
          <p class="organise__hint">A card can be in one collection at a time. Select a collection to see its cards.</p>
        </div>

        <form class="organise__form" @submit.prevent="onCreateCollection">
          <CommonAppInput
            v-model="newCollectionName"
            label="New collection"
            required
            maxlength="100"
            placeholder="For example: Reading list"
          />
          <CommonAppButton type="submit" :loading="collectionsLoading && !renamingId">
            <CommonAppIcon name="plus" :size="18" />
            Add collection
          </CommonAppButton>
        </form>

        <CommonAppAlert v-if="collectionsError">{{ collectionsError }}</CommonAppAlert>

        <CommonLoadingState v-if="!loaded" label="Loading your collections…" />
        <CommonEmptyState
          v-else-if="collections.length === 0"
          title="No collections yet"
          description="A collection is a shelf for cards that belong together, such as a project or a reading list. Name one above, then file cards on it from each card's page."
          icon="folder"
        />
        <ul v-else class="organise__grid">
          <li v-for="collection in collections" :key="collection.id">
            <CollectionsCollectionCard
              :collection="collection"
              :to="`/catalog?collectionId=${collection.id}`"
            >
              <form
                v-if="renamingId === collection.id"
                class="organise__rename"
                @submit.prevent="onRename(collection)"
                @keydown.esc="cancelRename"
              >
                <CommonAppInput
                  v-model="renameValue"
                  label="Collection name"
                  required
                  maxlength="100"
                />
                <div class="organise__rename-actions">
                  <CommonAppButton type="submit" size="sm" :loading="collectionsLoading">Save</CommonAppButton>
                  <CommonAppButton variant="ghost" size="sm" @click="cancelRename">Cancel</CommonAppButton>
                </div>
              </form>

              <template v-if="renamingId !== collection.id" #actions>
                <CommonAppButton variant="ghost" size="sm" @click="startRename(collection)">
                  <CommonAppIcon name="pencil" :size="16" />
                  Rename
                  <span class="visually-hidden">{{ collection.name }}</span>
                </CommonAppButton>
                <CommonAppButton variant="danger" size="sm" @click="onDeleteCollection(collection)">
                  <CommonAppIcon name="trash" :size="16" />
                  Delete
                  <span class="visually-hidden">{{ collection.name }}</span>
                </CommonAppButton>
              </template>
            </CollectionsCollectionCard>
          </li>
        </ul>
      </section>

      <!-- Tags -->
      <section class="stack" style="--stack-gap: var(--space-4)" aria-labelledby="tags-heading">
        <div class="organise__header">
          <h2 id="tags-heading" class="organise__title">Tags</h2>
          <p class="organise__hint">A card can have any number of tags. Select a tag to see its cards.</p>
        </div>

        <form class="organise__form" @submit.prevent="onCreateTag">
          <CommonAppInput
            v-model="newTagName"
            label="New tag"
            required
            maxlength="100"
            placeholder="For example: history"
          />
          <CommonAppButton type="submit" :loading="tagsLoading">
            <CommonAppIcon name="plus" :size="18" />
            Add tag
          </CommonAppButton>
        </form>

        <CommonAppAlert v-if="tagsError">{{ tagsError }}</CommonAppAlert>

        <CommonLoadingState v-if="!loaded" label="Loading your tags…" />
        <CommonEmptyState
          v-else-if="tags.length === 0"
          title="No tags yet"
          description="Tags are labels that cut across collections, like “to reread” or “history”. Create one above, or type a new one straight on a card's page."
          icon="catalog"
        />
        <ul v-else class="organise__tags" aria-label="Your tags">
          <li v-for="tag in tags" :key="tag.id" class="tag-chip">
            <NuxtLink :to="`/catalog?tagId=${tag.id}`" class="tag-chip__link">
              {{ tag.name }}
              <span class="tag-chip__count mono">{{ tag.cardCount ?? 0 }}</span>
            </NuxtLink>
            <button type="button" class="tag-chip__remove" @click="onDeleteTag(tag)">
              <CommonAppIcon name="close" :size="14" />
              <span class="visually-hidden">Delete tag {{ tag.name }}</span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>

<style scoped>
.organise__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.organise__title {
  font-size: var(--text-2xl);
}
.organise__hint {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
.organise__form {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-3);
  max-width: 36rem;
}
.organise__form > :first-child {
  flex: 1 1 16rem;
}
.organise__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
  gap: var(--space-4);
  list-style: none;
}
.organise__rename {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.organise__rename-actions {
  display: flex;
  gap: var(--space-2);
}

.organise__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  list-style: none;
}
.tag-chip {
  display: inline-flex;
  align-items: center;
  background: var(--bg-surface);
  border: var(--border-width) solid var(--border-default);
  border-radius: var(--radius-pill);
}
.tag-chip__link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2) var(--space-1) var(--space-3);
  color: var(--text-primary);
  font-size: var(--text-sm);
  text-decoration: none;
}
.tag-chip__link:hover {
  text-decoration: underline;
}
.tag-chip__count {
  color: var(--text-muted);
}
.tag-chip__remove {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  margin-right: var(--space-1);
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 50%;
  color: var(--text-secondary);
  cursor: pointer;
}
.tag-chip__remove:hover {
  background: var(--bg-hover);
  color: var(--error-text);
}
.tag-chip__remove:focus-visible,
.tag-chip__link:focus-visible {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}
</style>
