<script>
import { ref } from 'vue';

const isLoggedIn = ref(false)

</script>


<template>
    <header>
        <div>
            <RouterLink to="/"> Home</RouterLink>


        </div>
        <div v-if="isLoggedIn">

        </div>
    </header>
</template>